import os
import json
import base64
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai

# --- CONFIGURACIÓN ---
app = Flask(__name__)
# CORS robusto para permitir llamadas desde Vite (5173)
CORS(app, resources={r"/*": {"origins": "*"}})

# CLAVE DE API
API_KEY = "AIzaSyBN_8SN28frz2Y6_Wm9N4C1YEKPkaviROw"
genai.configure(api_key=API_KEY)

# Modelo
model = genai.GenerativeModel('gemini-2.5-flash')


@app.route('/analyze', methods=['POST'])
def analyze_report():
    try:
        data = request.json
        image_data = data.get('image')  # Base64
        description = data.get('description')

        if not image_data or not description:
            return jsonify({"error": "Faltan datos"}), 400

        print("Recibida petición de análisis...")

        # LIMPIAR BASE64: elimina cualquier metadata como data:image/png;base64,
        image_data = re.sub(r"^data:image\/[a-zA-Z0-9.+-]+;base64,", "", image_data)

        # Convertir base64 a bytes
        image_bytes = base64.b64decode(image_data)

        # Prompt estructurado
        prompt = f"""
        Actúa como un sistema experto en reportes ciudadanos.
        Analiza esta imagen y la descripción: "{description}".
        Responde SOLO con un JSON válido con esta estructura exacta:
        {{
            "problem_type": "Tipo de problema (ej: Bache, Basura, Electricidad)",
            "urgency": "Baja, Media o Alta",
            "suggested_action": "Acción recomendada corta"
        }}
        """

        # Enviar a Gemini
        response = model.generate_content([
            {'mime_type': 'image/jpeg', 'data': image_bytes},
            prompt
        ])

        # Limpiar el texto para quitar markdown
        json_text = response.text
        json_text = re.sub(r"```[a-zA-Z]*", "", json_text)  # elimina ```json o ```JSON
        json_text = json_text.replace("```", "").strip()

        print("Respuesta IA limpia:", json_text)

        return jsonify(json.loads(json_text))

    except Exception as e:
        print("Error:", e)
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')
