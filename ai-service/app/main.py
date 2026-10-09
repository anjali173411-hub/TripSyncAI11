from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from .planner import plan_trip, budget_tips

app = FastAPI(title="TripSync AI Service")

class Member(BaseModel):
    key: str
    name: str
    interests: List[str] = []
    pace: str = "balanced"
    budget_contribution: float = 0
    must_do: List[str] = []
    deal_breakers: List[str] = []
    notes: str = ""

class PlanRequest(BaseModel):
    destination: Optional[str] = ""
    start_location: str
    start_date: str
    end_date: str
    days: int
    budget: float
    travellers: int
    is_group: bool = False
    instructions: str = ""
    members: List[Member]

class TipActivity(BaseModel):
    id: str
    day: int
    title: str
    cost: float

class TipsRequest(BaseModel):
    destination: Optional[str] = ""
    budget: float
    planned_total: float = 0
    actual_total: float = 0
    planned_percent: float = 0
    actual_percent: float = 0
    by_category: dict = {}
    preferences: List[str] = []
    activities: List[TipActivity] = []

@app.get("/health")
async def health():
    return {"ok": True, "service": "ai-service"}

@app.post("/plan")
def plan(request: PlanRequest):
    try:
        return plan_trip(request.model_dump())
    except Exception as error:
        print("AI plan error:", error)
        raise HTTPException(status_code=502, detail="The AI service could not create a plan.")

@app.post("/budget-tips")
def tips(request: TipsRequest):
    try:
        return budget_tips(request.model_dump())
    except Exception as error:
        print("AI tips error:", error)
        raise HTTPException(status_code=502, detail="The AI service could not create tips.")
