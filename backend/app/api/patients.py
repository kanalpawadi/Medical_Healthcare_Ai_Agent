import re
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.patient import Patient
from app.models.visit import Visit
from app.services.ai_engine import build_transcript, detect_language, generate_medical_report
from app.services.session_store import end_session, get_session, start_session

router = APIRouter()


class SessionStartRequest(BaseModel):
    entry_point: str = "kiosk"
    language_preference: str = "Auto-Detect"
    full_name: Optional[str] = None
    mobile_number: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None


class SessionEndRequest(BaseModel):
    session_id: str


class SmsRequest(BaseModel):
    mobile_number: str
    report_url: str


@router.post("/session/start")
def start_kiosk_session(payload: SessionStartRequest, db: Session = Depends(get_db)):
    patient = Patient(
        full_name=payload.full_name or "Unknown patient",
        mobile_number=payload.mobile_number,
        age=payload.age,
        gender=payload.gender,
        language_preference=payload.language_preference,
    )
    db.add(patient)
    db.flush()

    visit = Visit(
        patient_id=patient.patient_id,
        entry_point=payload.entry_point,
        report_status="pending",
        medical_data={"status": "conversation_started"},
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)

    history = start_session(visit.visit_id)
    return {
        "session_id": visit.visit_id,
        "patient_id": patient.patient_id,
        "message": history[0]["content"],
    }


@router.post("/session/end")
async def end_kiosk_session(payload: SessionEndRequest, db: Session = Depends(get_db)):
    visit = db.query(Visit).filter(Visit.visit_id == payload.session_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Session not found")

    history = get_session(payload.session_id)
    if not history:
        history = end_session(payload.session_id)

    medical_data = await generate_medical_report(history)
    transcript = build_transcript(history)
    patient = db.query(Patient).filter(Patient.patient_id == visit.patient_id).first()

    if patient:
        patient.full_name = _extract_name(history) or patient.full_name or "Unknown patient"
        patient.mobile_number = medical_data.get("mobile_number") or patient.mobile_number
        patient.age = medical_data.get("age") or patient.age
        patient.language_preference = medical_data.get("detected_language") or patient.language_preference

    visit.session_end = datetime.utcnow()
    visit.raw_transcript = transcript
    visit.translated_transcript = transcript
    visit.medical_data = medical_data
    visit.report_status = "generated"
    visit.report_url = f"/api/visits/{visit.visit_id}/report"
    db.commit()

    end_session(payload.session_id)
    return _serialize_visit(visit, patient)


@router.post("/calls/inbound")
def inbound_call_stub():
    return {
        "message": "VoiceCare phone intake endpoint is ready. Configure Twilio Voice webhook to call this URL.",
        "websocket": "/ws/session/{session_id}",
    }


@router.post("/sms/send")
def send_sms_stub(payload: SmsRequest):
    return {
        "status": "queued",
        "mobile_number": payload.mobile_number,
        "report_url": payload.report_url,
        "message": "Twilio SMS delivery is stubbed for local demo mode.",
    }


@router.get("/patients")
def get_patients(db: Session = Depends(get_db)):
    visits = db.query(Visit).order_by(Visit.session_start.desc()).all()
    return [_serialize_visit(visit, visit.patient) for visit in visits]


@router.get("/patients/search")
def search_patients(q: str = "", db: Session = Depends(get_db)):
    query = db.query(Patient)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Patient.full_name.ilike(like), Patient.mobile_number.ilike(like)))
    patients = query.order_by(Patient.created_at.desc()).all()
    return [_serialize_patient(patient) for patient in patients]


@router.get("/patients/{patient_id}/visits")
def get_patient_visits(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return [_serialize_visit(visit, patient) for visit in patient.visits]


@router.get("/visits/{visit_id}/report")
def get_visit_report(visit_id: str, db: Session = Depends(get_db)):
    visit = db.query(Visit).filter(Visit.visit_id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    return _serialize_visit(visit, visit.patient)


@router.get("/admin/sessions")
def list_sessions(db: Session = Depends(get_db)):
    visits = db.query(Visit).order_by(Visit.session_start.desc()).all()
    return [
        {
            "session_id": visit.visit_id,
            "patient_id": visit.patient_id,
            "entry_point": visit.entry_point,
            "started_at": visit.session_start,
            "ended_at": visit.session_end,
            "report_status": visit.report_status,
        }
        for visit in visits
    ]


def _serialize_patient(patient: Patient) -> dict:
    return {
        "id": patient.patient_id,
        "name": patient.full_name,
        "mobile": patient.mobile_number,
        "age": patient.age,
        "gender": patient.gender,
        "language": patient.language_preference,
        "created_at": patient.created_at,
    }


def _serialize_visit(visit: Visit, patient: Optional[Patient]) -> dict:
    medical_data = visit.medical_data or {}
    report = medical_data.get("report", {})
    return {
        "id": visit.visit_id,
        "visit_id": visit.visit_id,
        "patient_id": visit.patient_id,
        "name": patient.full_name if patient else "Unknown patient",
        "mobile": patient.mobile_number if patient else None,
        "age": patient.age if patient else None,
        "gender": patient.gender if patient else None,
        "language": patient.language_preference if patient else medical_data.get("detected_language"),
        "entry_point": visit.entry_point,
        "status": "ready" if visit.report_status in {"generated", "delivered"} else "pending",
        "report_status": visit.report_status,
        "time": visit.session_start.strftime("%I:%M %p") if visit.session_start else "",
        "complaint": medical_data.get("chief_complaint") or "Registration in progress...",
        "summary": report.get("summary"),
        "medical_data": medical_data,
        "raw_transcript": visit.raw_transcript,
        "translated_transcript": visit.translated_transcript,
        "report_url": visit.report_url,
        "session_start": visit.session_start,
        "session_end": visit.session_end,
    }


def _extract_name(history: list[dict]) -> Optional[str]:
    text = " ".join(msg["content"] for msg in history if msg["role"] == "user")
    match = re.search(r"\b(?:my name is|i am|i'm|name is)\s+([A-Za-z ]{2,50})", text, re.IGNORECASE)
    if match:
        name = match.group(1).strip()
        return re.split(r"\b(?:age|mobile|phone|and|with|from)\b", name, flags=re.IGNORECASE)[0].strip()
    return None
