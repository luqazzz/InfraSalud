from flask import Flask, request, jsonify
from flask_cors import CORS
import base64

app = Flask(__name__)
CORS(app)

@app.route('/procesar_imagen', methods=['POST'])
def procesar_imagen():
    data = request.get_json()
    imagen_b64 = data.get("imagen")

    if not imagen_b64:
        return jsonify({"mensaje": "No se recibió imagen"}), 400

    # Guardar la imagen (opcional)
    img_data = imagen_b64.split(",")[1]
    with open("captura.png", "wb") as f:
        f.write(base64.b64decode(img_data))

    return jsonify({"mensaje": "Imagen recibida y procesada correctamente"})

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)
