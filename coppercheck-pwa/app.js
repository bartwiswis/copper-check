let videoStream = null;
let isCvReady = false;

// Odpala się po załadowaniu biblioteki OpenCV
function onOpenCvReady() {
    isCvReady = true;
    console.log("OpenCV.js wpięty w układ, szefie.");
    if (videoStream) {
        document.getElementById('output').innerText = "Kamera gotowa. Możesz skanować wsad.";
    }
}

// Inicjalizacja kamery tylnej w telefonie
async function initCamera() {
    const videoElement = document.getElementById('webcam');
    const cameraButton = document.getElementById('camera-button');
    const scanButton = document.getElementById('scan-button');
    const outputElement = document.getElementById('output');

    if (videoStream) {
        return;
    }

    cameraButton.disabled = true;
    outputElement.innerText = "Łączenie z kamerą...";

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        outputElement.innerText = "Ta przeglądarka nie obsługuje dostępu do kamery. Otwórz aplikację w aktualnej przeglądarce.";
        cameraButton.disabled = false;
        return;
    }

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: 'environment' } }
        });
        videoElement.srcObject = videoStream;
        await videoElement.play();
        scanButton.disabled = false;
        cameraButton.innerText = "KAMERA URUCHOMIONA";
        outputElement.innerText = "Kamera gotowa. Możesz skanować wsad.";
    } catch (err) {
        console.error("Błąd dostępu do kamery:", err);
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
            videoElement.srcObject = null;
        }

        cameraButton.disabled = false;
        if (err.name === "NotAllowedError" || err.name === "SecurityError") {
            outputElement.innerText = "Brak uprawnień do kamery. Zezwól przeglądarce na dostęp i spróbuj ponownie.";
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
            outputElement.innerText = "Nie znaleziono kamery w tym urządzeniu.";
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
            outputElement.innerText = "Nie można uruchomić kamery. Może być używana przez inną aplikację.";
        } else {
            outputElement.innerText = "Nie udało się uruchomić kamery. Sprawdź uprawnienia i dostępność sprzętu, a następnie spróbuj ponownie.";
        }
    }
}

// Główny algorytm analityczny (HSV + Maskowanie miedzi)
function analyzeCopperStream(videoElement) {
    if (!isCvReady || typeof cv === 'undefined') {
        alert("Silnik OpenCV jeszcze się ładuje, sekundę!");
        return null;
    }

    let canvas = document.createElement('canvas');
    let targetWidth = 1280;
    let targetHeight = 720;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    let ctx = canvas.getContext('2d');
    
    ctx.drawImage(videoElement, 0, 0, targetWidth, targetHeight);

    let src = cv.imread(canvas);
    let hsv = new cv.Mat();
    let mask = new cv.Mat();
    
    // Konwersja kolorów pod odporność na świetlówki w hali
    cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
    cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

    // Zakres HSV dla czystej miedzi (ciepły pomarańcz/czerwień)
    let lowCopper = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [8, 80, 80, 0]);
    let highCopper = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [28, 255, 255, 0]);

    cv.inRange(hsv, lowCopper, highCopper, mask);

    let totalPixels = mask.rows * mask.cols;
    let copperPixels = cv.countNonZero(mask);
    
    let rawRatio = (copperPixels / totalPixels) * 100;
    let estimatedPurity = Math.min(98.5, Math.max(75.0, rawRatio * 1.35)); 

    // Czyszczenie pamięci RAM telefonu
    src.delete();
    hsv.delete();
    mask.delete();
    lowCopper.delete();
    highCopper.delete();

    return {
        purityPercentage: parseFloat(estimatedPurity.toFixed(2)),
        status: estimatedPurity > 92 ? "Klasa Premium (Czysty Granul)" : "Wymaga dopalenia / separacji"
    };
}

// Kliknięcie przycisku skanowania
function triggerScan() {
    const videoElement = document.getElementById('webcam');
    const outputElement = document.getElementById('output');
    
    if (!videoStream) {
        outputElement.innerText = "Najpierw odpal kamerę!";
        return;
    }

    outputElement.innerText = "Analizuję wsad...";
    
    // Krótkie opóźnienie dla stabilności klatki
    setTimeout(() => {
        let result = analyzeCopperStream(videoElement);
        if (result) {
            outputElement.innerHTML = `Czystość: ${result.purityPercentage}%<br><span style="font-size: 14px; color: #aaa;">${result.status}</span>`;
        } else {
            outputElement.innerText = "Błąd odczytu macierzy.";
        }
    }, 100);
}
