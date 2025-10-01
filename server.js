const express = require('express');
const ytdl = require('ytdl-core');
const cors = require('cors');

const app = express();
// आप 8080 या कोई अन्य पोर्ट चुन सकते हैं
const PORT = 3000; 

// =======================================================
// ✨ CORS कॉन्फ़िगरेशन को अपडेट किया गया
// यह सभी स्रोतों (origins) और GET मेथड्स को अनुमति देता है।
// =======================================================
app.use(cors({
    origin: '*',  // सभी लोकलहोस्ट पोर्ट्स से अनुरोधों की अनुमति देता है
    methods: 'GET'
})); 

app.use(express.json());

// --------------------------------------------------------
// A. /info: वीडियो की जानकारी (Title, Formats) प्राप्त करने का एंडपॉइंट
// --------------------------------------------------------
app.get('/info', async (req, res) => {
    const videoURL = req.query.url; 

    if (!videoURL || !ytdl.validateURL(videoURL)) {
        return res.status(400).json({ error: 'Please enter a valid YouTube URL.' });
    }

    try {
        const info = await ytdl.getInfo(videoURL);
        
        // केवल वीडियो/ऑडियो (progressive) और mp4 फॉर्मेट्स को फ़िल्टर करें 
        // जो सीधे डाउनलोड के लिए उपयुक्त हों।
        const formats = info.formats
            .filter(f => f.qualityLabel || (f.hasAudio && f.hasVideo))
            .map(f => ({
                // बेहतर क्वालिटी नाम
                quality: f.qualityLabel || (f.container === 'mp4' ? `${f.resolution} (Muxed)` : f.mimeType.split(';')[0]),
                itag: f.itag,
                // फ़ाइल साइज़ उपलब्ध होने पर MB में दिखाएँ
                size: f.contentLength ? (f.contentLength / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown Size',
                // ज़रूरी metadata 
                mimeType: f.mimeType,
                container: f.container
            }));

        res.json({
            title: info.videoDetails.title,
            thumbnail: info.videoDetails.thumbnails[0].url,
            formats: formats
        });

    } catch (error) {
        // कंसोल में विस्तृत एरर लॉग करें (केवल डेवलपर के लिए)
        console.error("Error fetching video info from ytdl:", error.message);
        // फ्रंट-एंड को सामान्य एरर संदेश भेजें
        res.status(500).json({ error: 'Could not fetch video information. Check URL or video availability.' });
    }
});

// --------------------------------------------------------
// B. /download: वीडियो को सीधे स्ट्रीम करने का एंडपॉइंट
// --------------------------------------------------------
app.get('/download', (req, res) => {
    const videoURL = req.query.url;
    const itag = req.query.itag; 

    if (!videoURL || !ytdl.validateURL(videoURL) || !itag) {
        return res.status(400).send('Missing URL or selected quality (itag).');
    }
    
    // फ़ाइल नाम सेट करें और Content-Disposition हेडर से ब्राउज़र को 
    // डाउनलोड के लिए प्रेरित करें।
    res.header('Content-Disposition', `attachment; filename="youtube_video_${itag}.mp4"`);

    // ytdl-core से स्ट्रीम शुरू करें और उसे सीधे response (res) पर पाइप करें।
    // इससे सर्वर पर फाइल स्टोर नहीं होती, जो मेमोरी बचाती है।
    ytdl(videoURL, {
        filter: format => format.itag == itag,
        quality: 'highestvideo' // इसे itag के साथ ओवरराइड किया जाएगा
    }).pipe(res);
});

// --------------------------------------------------------
// सर्वर शुरू करें
// --------------------------------------------------------
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`Test Info Endpoint: http://localhost:${PORT}/info?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ`);
});
