import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Visit(Base):
    __tablename__ = "visits"

    visit_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, ForeignKey("patients.patient_id"))
    entry_point = Column(String(50)) # 'phone' or 'kiosk'
    session_start = Column(DateTime(timezone=True), server_default=func.now())
    session_end = Column(DateTime(timezone=True), nullable=True)
    raw_transcript = Column(Text, default="")
    translated_transcript = Column(Text, default="")
    medical_data = Column(JSON, default={}) # Structured JSON data
    report_url = Column(Text, nullable=True)
    report_status = Column(String(50), default="pending") # pending, generated, delivered

    patient = relationship("Patient", back_populates="visits")
