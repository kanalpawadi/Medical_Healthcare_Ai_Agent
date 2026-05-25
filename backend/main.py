from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
import app.models.patient
import app.models.visit
from app.api import patients
from app.services.session_store import append_message, get_session, start_session

# Create Database Tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="VoiceCare API", version="1.0.0")

# Allow CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(patients.router, prefix="/api", tags=["patients"])


@app.get("/")
def read_root():
    return {"message": "VoiceCare API is running"}

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

from app.services.ai_engine import generate_next_question

# Simple WebSocket endpoint for the Kiosk
@app.websocket("/ws/session/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    
    # Initialize session history
    history = start_session(session_id)
    
    await websocket.send_text(history[0]["content"])
    
    try:
        while True:
            # Receive audio/text from Kiosk
            data = await websocket.receive_text()
            print(f"Received from {session_id}: {data}")
            
            # Append patient's message to history
            append_message(session_id, "user", data)
            
            # Get next question from local LLaMA 3
            ai_response = await generate_next_question(get_session(session_id))
            
            # Append AI's response to history
            append_message(session_id, "assistant", ai_response)
            
            # Send back to frontend
            await websocket.send_text(ai_response)
            
    except Exception as e:
        print(f"WebSocket Disconnected/Error for {session_id}: {e}")
