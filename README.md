🤖 Interactive Portfolio Chatbot

An AI-powered chatbot designed to turn a static developer portfolio into an interactive conversation.
Instead of scrolling through pages, visitors can simply ask questions and instantly learn about my projects, skills, and experience.

⸻

🚀 Features

✅ Answers questions about my projects, skills, and background
✅ Searches a structured local JSON knowledge base first
✅ Falls back to an internal AI response engine when needed
✅ Optional OpenAI fallback for questions outside stored knowledge
✅ Smart suggestion chips to help users start conversations
✅ Hebrew normalization support (handles different spellings)
✅ Designed for seamless integration into a personal portfolio site

⸻

🧠 How It Works

The chatbot uses a multi-layer response strategy:
	1.	JSON Knowledge Base
	•	Fast local lookup
	•	Contains curated answers about my projects
	2.	Internal AI Logic Layer
	•	Attempts contextual understanding
	•	Generates responses using known project data
	3.	OpenAI API (Fallback)
	•	Used only when no local answer exists
	•	Provides broader intelligent responses

This approach keeps responses fast, controlled, and cost-efficient.

⸻

🛠 Tech Stack
	•	Backend: Node.js + Express
	•	AI Integration: OpenAI API
	•	Data Storage: Structured JSON knowledge base
	•	Frontend Integration: Custom chat overlay (HTML / CSS / JS)
	•	Hosting: Render

⸻

📂 Project Structure
project/
│── server.js
│── routes/
│── knowledge/
│    └── data.json
│── public/
│    └── chat-ui/
│── .env

⸻

💡 Purpose

This project demonstrates:
	•	Building real production-style backend logic
	•	Designing layered AI response systems
	•	Creating interactive developer portfolio experiences
	•	Combining structured data with generative AI

⸻

👨‍💻 Author

Mordechai (Moti) Amar
Computer Science Student | Software Developer

⸻

⭐ If you like this project, feel free to star the repo!
:::

