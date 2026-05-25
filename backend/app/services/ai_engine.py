import aiohttp
import json
import logging
import re

logger = logging.getLogger(__name__)

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3"

SYSTEM_PROMPT = """
You are VoiceCare, an AI medical receptionist for a hospital.
Your job is to collect the patient's medical history through a natural conversation.
Ask short, clear, and empathetic follow-up questions.
Do NOT give medical advice or diagnose the patient.
Focus ONLY on gathering: symptoms, duration, intensity, current medications, and past medical history.
Respond with ONLY what you want the text-to-speech engine to say next.
"""

LANGUAGE_KEYWORDS = {
    "hindi": ["hai", "mujhe", "dard", "bukhar", "mera", "naam", "umar", "mobile"],
    "kannada": ["nanage", "nanna", "hesaru", "jwara", "novu", "mobile", "vayassu"],
}

SYMPTOM_KEYWORDS = [
    "fever",
    "pain",
    "cough",
    "cold",
    "headache",
    "vomiting",
    "nausea",
    "breath",
    "chest",
    "stomach",
    "dizziness",
    "weakness",
    "rash",
]


def detect_language(text: str) -> str:
    lowered = text.lower()
    devanagari = any("\u0900" <= char <= "\u097f" for char in text)
    kannada = any("\u0c80" <= char <= "\u0cff" for char in text)

    if kannada:
        return "Kannada"
    if devanagari:
        return "Hindi"
    if any(word in lowered for word in LANGUAGE_KEYWORDS["kannada"]):
        return "Kannada"
    if any(word in lowered for word in LANGUAGE_KEYWORDS["hindi"]):
        return "Hindi"
    return "English"


def build_transcript(conversation_history: list[dict]) -> str:
    lines = []
    for msg in conversation_history:
        role = "AI" if msg["role"] == "assistant" else "Patient"
        lines.append(f"{role}: {msg['content']}")
    return "\n".join(lines)


def extract_medical_data(conversation_history: list[dict]) -> dict:
    patient_text = " ".join(
        msg["content"] for msg in conversation_history if msg["role"] == "user"
    )
    lowered = patient_text.lower()
    mobile_match = re.search(r"(?:\+91[\s-]?)?[6-9]\d{9}", patient_text.replace(" ", ""))
    age_match = re.search(r"\b(?:age is|age|i am|i'm|umar|vayassu)\s*(\d{1,3})\b", lowered)
    symptoms = [symptom for symptom in SYMPTOM_KEYWORDS if symptom in lowered]

    return {
        "detected_language": detect_language(patient_text) if patient_text else "English",
        "mobile_number": mobile_match.group(0) if mobile_match else None,
        "age": int(age_match.group(1)) if age_match else None,
        "chief_complaint": ", ".join(symptoms) if symptoms else "Not clearly stated",
        "symptoms": symptoms,
        "duration": _find_after_keywords(lowered, ["for", "since"], max_words=5),
        "current_medications": _find_after_keywords(lowered, ["medicine", "medication", "tablet"], max_words=8),
        "allergies": _find_after_keywords(lowered, ["allergy", "allergic"], max_words=8),
        "past_history": _find_after_keywords(lowered, ["history", "diabetes", "bp", "hypertension"], max_words=10),
        "family_history": _find_after_keywords(lowered, ["family history", "father", "mother"], max_words=10),
    }


def _find_after_keywords(text: str, keywords: list[str], max_words: int) -> str:
    words = text.split()
    for index, word in enumerate(words):
        if any(keyword in " ".join(words[index:index + 2]) for keyword in keywords):
            return " ".join(words[index:index + max_words])
    return "Not reported"

async def generate_next_question(conversation_history: list[dict]) -> str:
    """
    Sends the conversation history to the local LLaMA 3 model via Ollama
    and returns the next generated question.
    """
    
    # Format the prompt from the history
    prompt = SYSTEM_PROMPT + "\n\n"
    for msg in conversation_history:
        role = "AI" if msg["role"] == "assistant" else "Patient"
        prompt += f"{role}: {msg['content']}\n"
    prompt += "AI:"

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(OLLAMA_URL, json=payload) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get("response", "I understand. Could you please provide more details?").strip()
                else:
                    logger.error(f"Ollama returned status {response.status}")
                    return "I'm having trouble connecting to my medical database. Can you repeat that?"
    except aiohttp.ClientConnectorError:
        # If Ollama is not running locally, return a graceful fallback
        logger.warning("Could not connect to Ollama. Make sure it is running locally on port 11434.")
        return "I'm currently running in offline mode. I've recorded your response. Please continue."
    except Exception as e:
        logger.error(f"AI Engine Error: {e}")
        return "Sorry, I missed that. Could you please repeat?"

async def generate_medical_report(conversation_history: list[dict]) -> dict:
    """
    Generates a structured medical report (JSON) at the end of the session.
    """
    medical_data = extract_medical_data(conversation_history)
    transcript = build_transcript(conversation_history)
    prompt = f"""
Create a concise doctor-readable medical intake report as strict JSON.
Required keys: summary, patient_demographics, chief_complaint, symptoms, duration, medications, allergies, past_history, family_history, recommended_triage_note.
Do not diagnose. Use only the conversation details.

Conversation:
{transcript}
"""

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "format": "json",
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(OLLAMA_URL, json=payload) as response:
                if response.status == 200:
                    data = await response.json()
                    generated = json.loads(data.get("response", "{}"))
                    return {**medical_data, "report": generated}
                logger.error(f"Ollama report generation returned status {response.status}")
    except Exception as e:
        logger.warning(f"Falling back to local report generation: {e}")

    return {
        **medical_data,
        "report": {
            "summary": _fallback_summary(medical_data),
            "patient_demographics": {
                "age": medical_data["age"],
                "mobile_number": medical_data["mobile_number"],
                "language": medical_data["detected_language"],
            },
            "chief_complaint": medical_data["chief_complaint"],
            "symptoms": medical_data["symptoms"],
            "duration": medical_data["duration"],
            "medications": medical_data["current_medications"],
            "allergies": medical_data["allergies"],
            "past_history": medical_data["past_history"],
            "family_history": medical_data["family_history"],
            "recommended_triage_note": "Doctor review required. This intake report does not provide diagnosis or treatment advice.",
        },
    }


def _fallback_summary(medical_data: dict) -> str:
    complaint = medical_data.get("chief_complaint") or "not clearly stated"
    duration = medical_data.get("duration") or "not reported"
    return f"Patient reports {complaint}. Duration: {duration}. Additional clinical history should be confirmed by the doctor."
