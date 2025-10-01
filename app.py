from flask import Flask, request, jsonify, send_file
import yt_dlp
import os
import uuid
import threading
import time

app = Flask(__name__)
# Temporary directory jahan files store hongi
DOWNLOAD_DIR = 'temp_downloads'
if not os.path.exists(DOWNLOAD_DIR):
    os.makedirs(DOWNLOAD_DIR)

# File cleaning thread
def clean_old_files():
    while True:
        # Har ghante (1 hour) mein check karein
        time.sleep(3600) 
        now = time.time()
        for filename in os.listdir(DOWNLOAD_DIR):
            file_path = os.path.join(DOWNLOAD_DIR, filename)
            # Agar file 1 ghante (3600 seconds) se purani hai to delete kar dein
            if os.stat(file_path).st_mtime < now - 3600:
                try:
                    os.remove(file_path)
                    print(f"Cleaned up old file: {filename}")
                except Exception as e:
                    print(f"Error cleaning file {filename}: {e}")

# Clean up thread start karein
threading.Thread(target=clean_old_files, daemon=True).start()

# --- Naya Root Route Add Kiya Gaya Hai ---
@app.route('/')
def home():
    # Jab user root URL khole ga, toh yeh message dikhega.
    return "YouTube Shorts Downloader API is Running! Use the /download endpoint to process links."
# ----------------------------------------

@app.route('/download', methods=['POST'])
def handle_download():
    data = request.get_json()
    url = data.get('youtube_url')

    if not url:
        return jsonify({"success": False, "message": "URL missing"}), 400

    # Ek unique naam banao taaki files aapas mein na takraayein
    unique_id = str(uuid.uuid4())
    temp_filepath = os.path.join(DOWNLOAD_DIR, f"{unique_id}.mp4")

    # yt-dlp options for best MP4 short video
    ydl_opts = {
        # Best quality video with audio in MP4 format
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': temp_filepath,
        'noplaylist': True,
        'quiet': True,
        'noprogress': True,
        'force-overwrite': True,
        'retries': 3
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Video information nikalna
            info_dict = ydl.extract_info(url, download=True)
            
            # Agar download successful raha
            if os.path.exists(temp_filepath):
                # Yahan hum client ko direct download link bhejte hain
                # Jismein file ko server se serve kiya ja raha hai
                download_link = request.host_url.rstrip('/') + f'/serve_file/{unique_id}'
                
                return jsonify({
                    "success": True, 
                    "download_url": download_link,
                    "title": info_dict.get('title', 'video')
                })
            else:
                return jsonify({"success": False, "message": "File could not be created."}), 500

    except Exception as e:
        print(f"yt-dlp error: {e}")
        return jsonify({"success": False, "message": "Failed to process video link. It might be private or an invalid URL."}), 500


@app.route('/serve_file/<unique_id>', methods=['GET'])
def serve_file(unique_id):
    filepath = os.path.join(DOWNLOAD_DIR, f"{unique_id}.mp4")
    
    if os.path.exists(filepath):
        # File ko user ko bhejte hain (as a download)
        return send_file(filepath, as_attachment=True, download_name=f"short_{unique_id}.mp4")
    else:
        return "File Not Found or link expired", 404

# Agar aap is file ko seedhe chalaate hain
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)