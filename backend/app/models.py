import uuid
from datetime import datetime

from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, ARRAY, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="professor")  # "admin" or "professor"
    profile_image = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # A professor is linked to one module
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id"), nullable=True)
    module = relationship("Module", back_populates="professor_user")


class Student(Base):
    __tablename__ = "students"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    profile_image = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    embeddings = relationship("FaceEmbedding", back_populates="student")
    attendances = relationship("AttendanceRecord", back_populates="student")


class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_ref = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    embedding = Column(ARRAY(Float), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="embeddings")


class Module(Base):
    __tablename__ = "modules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    total_weeks = Column(Integer, default=14)
    created_at = Column(DateTime, default=datetime.utcnow)

    professor_user = relationship("User", back_populates="module", uselist=False)
    sessions = relationship("Session", back_populates="module")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id = Column(UUID(as_uuid=True), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    week_number = Column(Integer, nullable=False)
    session_date = Column(DateTime, default=datetime.utcnow)
    video_filename = Column(String(255), nullable=True)
    status = Column(String(50), default="pending")  # pending, processing, completed
    created_at = Column(DateTime, default=datetime.utcnow)

    module = relationship("Module", back_populates="sessions")
    attendances = relationship("AttendanceRecord", back_populates="session")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    student_ref = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    is_present = Column(Boolean, default=False)
    confidence = Column(Float, nullable=True)
    detected_at_sec = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="attendances")
    student = relationship("Student", back_populates="attendances")


class Reclamation(Base):
    __tablename__ = "reclamations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_ref = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    message = Column(Text, nullable=False)
    attachment = Column(Text, nullable=True)  # base64 encoded file
    status = Column(String(50), default="pending")  # pending, approved, declined
    professor_response = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    student = relationship("Student")
    session = relationship("Session")
