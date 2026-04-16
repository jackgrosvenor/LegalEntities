from fastapi import FastAPI, APIRouter, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import csv
import json
from pathlib import Path
from typing import Optional

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def parse_csv_row(row):
    cleaned = {}
    for key, value in row.items():
        if value is None:
            cleaned[key] = None
        elif isinstance(value, str):
            value = value.strip()
            if value == '':
                cleaned[key] = None
            elif value.lower() == 'true':
                cleaned[key] = True
            elif value.lower() == 'false':
                cleaned[key] = False
            else:
                try:
                    if '.' in value and value.replace('.', '', 1).replace('-', '', 1).isdigit():
                        cleaned[key] = float(value)
                    elif value.lstrip('-').isdigit():
                        cleaned[key] = int(value)
                    else:
                        cleaned[key] = value
                except ValueError:
                    cleaned[key] = value
        else:
            cleaned[key] = value
    return cleaned


async def seed_database():
    entity_count = await db.entities.count_documents({})
    if entity_count > 0:
        logger.info(f"Database already seeded with {entity_count} entities. Skipping.")
        return

    logger.info("Seeding database from CSV files...")

    # Read Entity Master
    entities = []
    csv_path = ROOT_DIR / 'entity_master.csv'
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            entity = parse_csv_row(row)
            if entity.get('SYMBOLOGIES') and isinstance(entity['SYMBOLOGIES'], str):
                try:
                    entity['SYMBOLOGIES'] = json.loads(entity['SYMBOLOGIES'])
                except json.JSONDecodeError:
                    entity['SYMBOLOGIES'] = None
            entities.append(entity)

    if entities:
        await db.entities.insert_many(entities)
        logger.info(f"Inserted {len(entities)} entities")

    # Read Entity Relations
    relations = []
    csv_path = ROOT_DIR / 'entity_relations.csv'
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            relation = parse_csv_row(row)
            relations.append(relation)

    if relations:
        await db.relations.insert_many(relations)
        logger.info(f"Inserted {len(relations)} relations")

    # Create indexes
    await db.entities.create_index("ENTITY_ID")
    await db.entities.create_index("FUND_ID")
    await db.entities.create_index("IS_TOP_OF_STRUCTURE")
    await db.entities.create_index("COMPANY_NAME")
    await db.relations.create_index("PARENT_ID")
    await db.relations.create_index("CHILD_ID")

    logger.info("Database seeding complete")


@app.on_event("startup")
async def startup_event():
    await seed_database()


@api_router.get("/")
async def root():
    return {"message": "Entity Mapping API"}


@api_router.get("/funds")
async def get_funds():
    pipeline = [
        {"$match": {"FUND_ID": {"$ne": None}, "DELETED": {"$ne": True}}},
        {"$group": {"_id": "$FUND_ID", "fund_name": {"$first": "$FUND_NAME"}}},
        {"$sort": {"_id": 1}}
    ]
    results = await db.entities.aggregate(pipeline).to_list(1000)
    funds = [{"fund_id": r["_id"], "fund_name": r.get("fund_name") or f"Fund {r['_id']}"} for r in results]
    return {"funds": funds}


@api_router.get("/entities")
async def get_entities(
    search: Optional[str] = Query(None),
    jurisdiction: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    fund_id: Optional[int] = Query(None),
    asset_name: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0)
):
    query = {"DELETED": {"$ne": True}}
    if search:
        query["COMPANY_NAME"] = {"$regex": search, "$options": "i"}
    if jurisdiction:
        query["JURISDICTION"] = jurisdiction
    if entity_type:
        query["ENTITY_TYPE"] = entity_type
    if fund_id is not None:
        query["FUND_ID"] = fund_id
    if asset_name:
        query["ASSET_NAME"] = {"$regex": asset_name, "$options": "i"}

    total = await db.entities.count_documents(query)
    entities = await db.entities.find(query, {"_id": 0}).sort("COMPANY_NAME", 1).skip(offset).limit(limit).to_list(limit)

    return {"entities": entities, "total": total}


@api_router.get("/entities/filters")
async def get_entity_filters():
    jurisdictions = await db.entities.distinct("JURISDICTION", {"JURISDICTION": {"$ne": None}, "DELETED": {"$ne": True}})
    entity_types = await db.entities.distinct("ENTITY_TYPE", {"ENTITY_TYPE": {"$ne": None}, "DELETED": {"$ne": True}})

    return {
        "jurisdictions": sorted([j for j in jurisdictions if j]),
        "entity_types": sorted([e for e in entity_types if e])
    }


@api_router.get("/entities/{entity_id}")
async def get_entity(entity_id: int):
    entity = await db.entities.find_one({"ENTITY_ID": entity_id}, {"_id": 0})
    if not entity:
        return {"error": "Entity not found"}
    return {"entity": entity}


@api_router.get("/funds/{fund_id}/tree")
async def get_fund_tree(fund_id: int):
    # Find root entities for this fund
    roots = await db.entities.find(
        {"FUND_ID": fund_id, "IS_TOP_OF_STRUCTURE": True, "DELETED": {"$ne": True}},
        {"_id": 0}
    ).to_list(100)

    if not roots:
        fund_entities = await db.entities.find(
            {"FUND_ID": fund_id, "DELETED": {"$ne": True}},
            {"_id": 0}
        ).to_list(1000)
        if not fund_entities:
            return {"nodes": [], "edges": [], "fund_name": ""}
        entity_ids = [e["ENTITY_ID"] for e in fund_entities]
        rels = await db.relations.find(
            {"PARENT_ID": {"$in": entity_ids}, "DELETED": {"$ne": True}},
            {"_id": 0}
        ).to_list(5000)
        child_ids = set(r["CHILD_ID"] for r in rels)
        roots = [e for e in fund_entities if e["ENTITY_ID"] not in child_ids]
        if not roots:
            roots = fund_entities[:1]

    # BFS to build full tree from roots
    visited = set()
    queue = [r["ENTITY_ID"] for r in roots]
    all_entity_ids = set()
    all_relations = []

    while queue:
        current_id = queue.pop(0)
        if current_id in visited:
            continue
        visited.add(current_id)
        all_entity_ids.add(current_id)

        child_relations = await db.relations.find(
            {"PARENT_ID": current_id, "DELETED": {"$ne": True}},
            {"_id": 0}
        ).to_list(500)

        for rel in child_relations:
            all_relations.append(rel)
            child_id = rel["CHILD_ID"]
            if child_id not in visited:
                queue.append(child_id)

    # Fetch all entity details
    entities = []
    if all_entity_ids:
        entities = await db.entities.find(
            {"ENTITY_ID": {"$in": list(all_entity_ids)}},
            {"_id": 0}
        ).to_list(5000)

    # Build nodes
    nodes = []
    for entity in entities:
        eid = entity["ENTITY_ID"]
        nodes.append({
            "id": str(eid),
            "data": {
                "label": entity.get("COMPANY_NAME", f"Entity {eid}"),
                "entity_type": entity.get("ENTITY_TYPE", ""),
                "jurisdiction": entity.get("JURISDICTION", ""),
                "is_top": entity.get("IS_TOP_OF_STRUCTURE", False),
                "fund_name": entity.get("FUND_NAME", ""),
                "asset_name": entity.get("ASSET_NAME", ""),
                "entity_id": eid
            },
            "type": "entityNode"
        })

    # Build edges (deduplicated)
    edges = []
    seen_edges = set()
    for rel in all_relations:
        edge_key = f"{rel['PARENT_ID']}-{rel['CHILD_ID']}"
        if edge_key in seen_edges:
            continue
        seen_edges.add(edge_key)

        ownership = rel.get("EQUITIX_OWNERSHIP_DECIMAL", 0)
        if isinstance(ownership, (int, float)):
            ownership_pct = f"{ownership * 100:.1f}%"
        else:
            ownership_pct = str(ownership)

        edges.append({
            "id": f"e-{rel['PARENT_ID']}-{rel['CHILD_ID']}",
            "source": str(rel["PARENT_ID"]),
            "target": str(rel["CHILD_ID"]),
            "type": "ownershipEdge",
            "data": {
                "ownership": ownership_pct,
                "relation_type": rel.get("RELATION_TYPE", "EQUITY"),
                "ownership_decimal": ownership if isinstance(ownership, (int, float)) else 0
            }
        })

    fund_name = ""
    for r in roots:
        if r.get("FUND_NAME"):
            fund_name = r["FUND_NAME"]
            break

    return {"nodes": nodes, "edges": edges, "fund_name": fund_name}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
