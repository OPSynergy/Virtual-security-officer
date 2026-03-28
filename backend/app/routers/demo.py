from fastapi import APIRouter

from app.demo_data import get_demo_scan_data

router = APIRouter()


@router.get("/results")
async def demo_results():
    return get_demo_scan_data()
