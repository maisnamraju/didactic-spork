# TeraLeads AI Service (FastAPI)

Minimal Python microservice for AI-assisted chat replies.

## Features

- `POST /generate` accepts `message` and optional `patient_context`
- Supports `mock` mode and `openrouter` mode
- Environment-driven configuration
- Returns structured errors for configuration/provider failures

## Setup

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r ai-service/requirements.txt
```

3. Configure environment variables:

```bash
cp ai-service/.env.example ai-service/.env
```

4. Start the service:

```bash
uvicorn main:app --app-dir ai-service/app --host 0.0.0.0 --port 8000 --env-file ai-service/.env --reload
```

## API

### POST `/generate`

Request:

```json
{
  "message": "Patient reports gum pain after flossing.",
  "patient_context": {
    "patient_id": 123,
    "patient_name": "Jane Doe",
    "medical_notes": "No known allergies"
  }
}
```

Response:

```json
{
  "message": "Helpful assistant response",
  "provider": "openrouter",
  "model": "openai/gpt-4o-mini"
}
```
