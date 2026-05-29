// Configuration - UPDATE THIS after deploying the workflow
const WEBHOOK_URL = 'https://brd.app.n8n.cloud/webhook/hs-video-generator';

// Character images (local files)
const CHARACTER_IMAGES = {
    'Alex': 'images/Alex.png',
    'Maria': 'images/Maria.png',
    'James': 'images/James.png',
    'Priya': 'images/Priya.png',
    'Marcus': 'images/Marcus.png',
    'Emma': 'images/Emma.png'
};

// DOM Elements
const form = document.getElementById('videoForm');
const characterSelect = document.getElementById('character');
const characterPreview = document.getElementById('characterPreview');
const characterImage = document.getElementById('characterImage');
const imageSourceSelect = document.getElementById('imageSource');
const uploadSection = document.getElementById('uploadSection');
const uploadArea = document.getElementById('uploadArea');
const uploadImage = document.getElementById('uploadImage');
const uploadPreview = document.getElementById('uploadPreview');
const submitBtn = document.getElementById('submitBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingStatus = document.getElementById('loadingStatus');
const resultSection = document.getElementById('resultSection');
const resultVideo = document.getElementById('resultVideo');
const driveLink = document.getElementById('driveLink');
const newVideoBtn = document.getElementById('newVideoBtn');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');

let uploadedImageData = null;

// Character preview on selection
characterSelect.addEventListener('change', (e) => {
    const character = e.target.value;
    if (character && CHARACTER_IMAGES[character]) {
        characterImage.src = CHARACTER_IMAGES[character];
        characterPreview.classList.add('has-image');
    } else {
        characterImage.src = '';
        characterPreview.classList.remove('has-image');
    }
});

// Toggle upload section based on image source
imageSourceSelect.addEventListener('change', (e) => {
    if (e.target.value === 'Upload Images') {
        uploadSection.style.display = 'block';
    } else {
        uploadSection.style.display = 'none';
        uploadedImageData = null;
        uploadPreview.style.display = 'none';
        uploadArea.classList.remove('has-image');
    }
});

// Handle file upload
uploadImage.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            uploadedImageData = event.target.result;
            uploadPreview.src = uploadedImageData;
            uploadPreview.style.display = 'block';
            uploadArea.classList.add('has-image');
        };
        reader.readAsDataURL(file);
    }
});

// Drag and drop support
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#00d9ff';
});

uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '';
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        uploadImage.files = e.dataTransfer.files;
        const event = new Event('change');
        uploadImage.dispatchEvent(event);
    }
});

// Form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const scenario = document.getElementById('scenario').value.trim();
    const character = characterSelect.value;
    const imageSource = imageSourceSelect.value;

    // Validation
    if (!scenario) {
        alert('Please enter a scenario description.');
        return;
    }

    if (!character) {
        alert('Please select a character.');
        return;
    }

    if (imageSource === 'Upload Images' && !uploadedImageData) {
        alert('Please upload an image.');
        return;
    }

    // Prepare request data
    const requestData = {
        scenarioDescription: scenario,
        character: character,
        imageSource: imageSource,
        uploadedImage: imageSource === 'Upload Images' ? uploadedImageData : null
    };

    // Show loading
    showLoading();

    try {
        // Simulate step progress (since we can't get real progress from n8n)
        simulateProgress();

        // Send request to n8n webhook
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            // Try to get error message from response
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const contentType = response.headers.get('Content-Type') || '';

        if (contentType.includes('video/')) {
            // Binary video response - get as blob directly
            const videoBlob = await response.blob();
            const fileName = getFileNameFromResponse(response) || 'HS_Video.mp4';
            showResult({ videoBlob, mimeType: contentType, fileName });
        } else {
            // JSON response (likely error)
            const result = await response.json();
            if (result.success && result.videoData) {
                // Fallback: base64 encoded video in JSON (legacy)
                showResultFromBase64(result);
            } else {
                throw new Error(result.error || 'Video generation failed');
            }
        }
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    }
});

function showLoading() {
    form.style.display = 'none';
    resultSection.style.display = 'none';
    errorSection.style.display = 'none';
    loadingOverlay.style.display = 'flex';
    loadingStatus.textContent = 'Initializing...';

    // Reset steps
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active', 'completed');
    });
}

function simulateProgress() {
    const steps = [
        { id: 'step1', text: 'Processing request...', delay: 0 },
        { id: 'step2', text: 'Generating image with character...', delay: 5000 },
        { id: 'step3', text: 'Creating video...', delay: 45000 },
        { id: 'step4', text: 'Uploading to Drive...', delay: 120000 }
    ];

    steps.forEach((step, index) => {
        setTimeout(() => {
            // Mark previous steps as completed
            for (let i = 0; i < index; i++) {
                document.getElementById(steps[i].id).classList.remove('active');
                document.getElementById(steps[i].id).classList.add('completed');
            }
            // Mark current step as active
            document.getElementById(step.id).classList.add('active');
            loadingStatus.textContent = step.text;
        }, step.delay);
    });
}

// Extract filename from Content-Disposition header
function getFileNameFromResponse(response) {
    const disposition = response.headers.get('Content-Disposition');
    if (disposition) {
        const match = disposition.match(/filename="?([^";\n]+)"?/i);
        if (match) return match[1];
    }
    return null;
}

// Handle binary video blob response (new method)
function showResult(result) {
    loadingOverlay.style.display = 'none';
    resultSection.style.display = 'block';

    const blob = result.videoBlob;
    const mimeType = result.mimeType || 'video/mp4';
    const fileName = result.fileName || 'HS_Video.mp4';
    const blobUrl = URL.createObjectURL(blob);

    // Store for download
    window.generatedVideoBlob = blob;
    window.generatedVideoName = fileName;

    // Update video container
    const videoContainer = document.querySelector('.video-container');
    videoContainer.innerHTML = `
        <video id="resultVideo" controls width="100%" style="max-height: 400px; background: #000;">
            <source src="${blobUrl}" type="${mimeType}">
            Your browser does not support the video tag.
        </video>
    `;

    // Update download button
    driveLink.textContent = 'Download Video';
    driveLink.href = blobUrl;
    driveLink.download = fileName;
}

// Fallback: Handle base64 encoded video in JSON (legacy)
function showResultFromBase64(result) {
    loadingOverlay.style.display = 'none';
    resultSection.style.display = 'block';

    if (result.videoData) {
        // Convert base64 to blob URL for playback
        const byteCharacters = atob(result.videoData);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: result.mimeType || 'video/mp4' });
        const blobUrl = URL.createObjectURL(blob);

        // Store for download
        window.generatedVideoBlob = blob;
        window.generatedVideoName = result.fileName || 'HS_Video.mp4';

        // Update video container
        const videoContainer = document.querySelector('.video-container');
        videoContainer.innerHTML = `
            <video id="resultVideo" controls width="100%" style="max-height: 400px; background: #000;">
                <source src="${blobUrl}" type="${result.mimeType || 'video/mp4'}">
                Your browser does not support the video tag.
            </video>
        `;

        // Update download button
        driveLink.textContent = 'Download Video';
        driveLink.href = blobUrl;
        driveLink.download = result.fileName || 'HS_Video.mp4';
    }
}

function showError(message) {
    loadingOverlay.style.display = 'none';
    errorSection.style.display = 'block';
    errorMessage.textContent = message;
}

// Reset to form
newVideoBtn.addEventListener('click', resetForm);
retryBtn.addEventListener('click', resetForm);

function resetForm() {
    form.style.display = 'block';
    resultSection.style.display = 'none';
    errorSection.style.display = 'none';
    form.reset();
    characterPreview.classList.remove('has-image');
    characterImage.src = '';
    uploadSection.style.display = 'none';
    uploadedImageData = null;
    uploadPreview.style.display = 'none';
    uploadArea.classList.remove('has-image');
}
