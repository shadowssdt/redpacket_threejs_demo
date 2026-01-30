/**
 * 🧧 新春红包雨 - 手势抓红包
 * 基于 Three.js + MediaPipe Hands
 */

// ==================== 全局变量 ====================
let scene, camera, renderer;
let redPackets = []; // 红包数组
let collectedCount = 0; // 已收集红包数
let totalAmount = 0; // 总金额
let isGrabbing = false; // 是否正在抓取
let lastGrabTime = 0; // 上次抓取时间
let comboCount = 0; // 连击数

// 手势相关
let hands = null;
let isCameraActive = false;
let gestureValue = 0; // 0-1, 0=张开, 1=握拳
let targetGestureValue = 0;
let handPosition = { x: 0, y: 0 }; // 手在屏幕上的位置

// DOM 元素
let videoElement, handCanvas, handCtx;

// 配置
const CONFIG = {
    maxPackets: 50,           // 最大红包数量
    spawnInterval: 300,       // 生成间隔(ms)
    fallSpeed: 0.3,           // 下落速度
    grabRadius: 80,           // 抓取半径
    grabThreshold: 0.6,       // 握拳阈值
    minAmount: 0.01,          // 最小金额
    maxAmount: 8.88,          // 最大金额
    luckyAmount: 88.88,       // 幸运金额
    luckyChance: 0.02         // 幸运金额概率
};

// ==================== 初始化 ====================
function init() {
    // 创建场景
    scene = new THREE.Scene();
    
    // 创建相机 (正交相机更适合2D效果)
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.OrthographicCamera(
        -window.innerWidth / 2, window.innerWidth / 2,
        window.innerHeight / 2, -window.innerHeight / 2,
        0.1, 1000
    );
    camera.position.z = 100;
    
    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    document.getElementById('canvas-container').appendChild(renderer.domElement);
    
    // 初始化 DOM 引用
    videoElement = document.getElementById('video');
    handCanvas = document.getElementById('hand-canvas');
    handCtx = handCanvas.getContext('2d');
    
    // 设置事件监听
    setupEventListeners();
    
    // 开始动画循环
    animate();
    
    // 窗口大小调整
    window.addEventListener('resize', onWindowResize);
}

// ==================== 红包系统 ====================
class RedPacket {
    constructor() {
        this.createMesh();
        this.reset();
    }
    
    createMesh() {
        // 创建红包几何体 (扁平的长方形)
        const geometry = new THREE.PlaneGeometry(50, 65);
        
        // 创建红包材质 (渐变红色)
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 160;
        const ctx = canvas.getContext('2d');
        
        // 红包背景渐变
        const gradient = ctx.createLinearGradient(0, 0, 0, 160);
        gradient.addColorStop(0, '#ff4444');
        gradient.addColorStop(0.5, '#cc0000');
        gradient.addColorStop(1, '#990000');
        
        // 绘制红包主体
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(4, 4, 120, 152, 10);
        ctx.fill();
        
        // 金色边框
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 4;
        ctx.stroke();
        
        // 绘制金色装饰线
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(20, 50);
        ctx.lineTo(108, 50);
        ctx.stroke();
        
        // 绘制"福"字或金币图案
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 48px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('¥', 64, 100);
        
        // 顶部装饰
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(64, 30, 15, 0, Math.PI * 2);
        ctx.fill();
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshBasicMaterial({ 
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        scene.add(this.mesh);
    }
    
    reset() {
        // 随机位置 (顶部外)
        this.mesh.position.x = (Math.random() - 0.5) * window.innerWidth * 0.8;
        this.mesh.position.y = window.innerHeight / 2 + 100 + Math.random() * 200;
        this.mesh.position.z = Math.random() * 10;
        
        // 随机旋转
        this.mesh.rotation.z = (Math.random() - 0.5) * 0.3;
        
        // 随机速度
        this.velocityY = -(CONFIG.fallSpeed + Math.random() * 0.2);
        this.velocityX = (Math.random() - 0.5) * 0.5;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
        
        // 随机金额
        if (Math.random() < CONFIG.luckyChance) {
            this.amount = CONFIG.luckyAmount;
            this.isLucky = true;
            this.mesh.scale.set(1.3, 1.3, 1);
        } else {
            this.amount = CONFIG.minAmount + Math.random() * (CONFIG.maxAmount - CONFIG.minAmount);
            this.amount = Math.round(this.amount * 100) / 100;
            this.isLucky = false;
            this.mesh.scale.set(1, 1, 1);
        }
        
        this.collected = false;
        this.mesh.visible = true;
    }
    
    update() {
        if (this.collected) return;
        
        // 下落
        this.mesh.position.y += this.velocityY;
        this.mesh.position.x += this.velocityX;
        this.mesh.rotation.z += this.rotationSpeed;
        
        // 左右摇摆
        this.mesh.position.x += Math.sin(Date.now() * 0.002 + this.mesh.position.y * 0.01) * 0.3;
        
        // 超出底部则重置
        if (this.mesh.position.y < -window.innerHeight / 2 - 100) {
            this.reset();
        }
    }
    
    // 检查是否在抓取范围内
    isInGrabRange(screenX, screenY) {
        // 将红包位置转换为屏幕坐标
        const packetScreenX = this.mesh.position.x + window.innerWidth / 2;
        const packetScreenY = window.innerHeight / 2 - this.mesh.position.y;
        
        const dx = packetScreenX - screenX;
        const dy = packetScreenY - screenY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return distance < CONFIG.grabRadius;
    }
    
    // 收集红包
    collect() {
        if (this.collected) return 0;
        this.collected = true;
        this.mesh.visible = false;
        return this.amount;
    }
}

// 生成红包
function spawnRedPacket() {
    if (redPackets.length < CONFIG.maxPackets) {
        redPackets.push(new RedPacket());
    }
}

// 开始红包雨
let spawnInterval = null;
function startRedPacketRain() {
    if (spawnInterval) return;
    
    // 初始生成一些红包
    for (let i = 0; i < 10; i++) {
        setTimeout(() => spawnRedPacket(), i * 100);
    }
    
    // 持续生成
    spawnInterval = setInterval(spawnRedPacket, CONFIG.spawnInterval);
}

function stopRedPacketRain() {
    if (spawnInterval) {
        clearInterval(spawnInterval);
        spawnInterval = null;
    }
}

// ==================== 抓取逻辑 ====================
function tryGrabPackets() {
    if (!isGrabbing) return;
    
    const now = Date.now();
    if (now - lastGrabTime < 100) return; // 限制抓取频率
    lastGrabTime = now;
    
    // 手的屏幕位置
    const handScreenX = handPosition.x * window.innerWidth;
    const handScreenY = handPosition.y * window.innerHeight;
    
    let grabbedThisFrame = 0;
    let totalGrabbedAmount = 0;
    
    redPackets.forEach(packet => {
        if (!packet.collected && packet.isInGrabRange(handScreenX, handScreenY)) {
            const amount = packet.collect();
            if (amount > 0) {
                grabbedThisFrame++;
                totalGrabbedAmount += amount;
                collectedCount++;
                totalAmount += amount;
                
                // 创建收集特效
                createCollectEffect(handScreenX, handScreenY, amount, packet.isLucky);
                
                // 一段时间后重置红包
                setTimeout(() => packet.reset(), 500);
            }
        }
    });
    
    // 更新统计显示
    if (grabbedThisFrame > 0) {
        updateStats();
        
        // 连击
        comboCount += grabbedThisFrame;
        if (comboCount > 1) {
            showCombo(comboCount, handScreenX, handScreenY);
        }
    }
}

// 创建收集特效
function createCollectEffect(x, y, amount, isLucky) {
    // 显示金额弹出
    showAmountPopup(amount, isLucky);
    
    // 金币爆炸效果
    createCoinExplosion(x, y, isLucky ? 15 : 8);
    
    // 红包收集动画
    const packetDiv = document.createElement('div');
    packetDiv.className = 'collected-packet';
    packetDiv.textContent = '🧧';
    packetDiv.style.left = x + 'px';
    packetDiv.style.top = y + 'px';
    document.body.appendChild(packetDiv);
    
    setTimeout(() => packetDiv.remove(), 500);
}

// 显示金额弹出
function showAmountPopup(amount, isLucky) {
    const popup = document.getElementById('amount-popup');
    const amountSpan = popup.querySelector('.popup-amount');
    
    amountSpan.textContent = '+¥' + amount.toFixed(2);
    amountSpan.style.color = isLucky ? '#ff6600' : '#ffd700';
    amountSpan.style.fontSize = isLucky ? '64px' : '48px';
    
    popup.classList.remove('hidden');
    
    // 重新触发动画
    amountSpan.style.animation = 'none';
    amountSpan.offsetHeight; // 触发重排
    amountSpan.style.animation = 'popupAnim 1s ease-out forwards';
    
    setTimeout(() => popup.classList.add('hidden'), 1000);
}

// 金币爆炸效果
function createCoinExplosion(x, y, count) {
    const emojis = ['💰', '🪙', '✨', '⭐'];
    
    for (let i = 0; i < count; i++) {
        const coin = document.createElement('div');
        coin.className = 'coin-particle';
        coin.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        coin.style.left = x + 'px';
        coin.style.top = y + 'px';
        
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const distance = 50 + Math.random() * 80;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance - 30;
        
        coin.style.setProperty('--tx', tx + 'px');
        coin.style.setProperty('--ty', ty + 'px');
        coin.style.animation = `coinExplode 0.6s ease-out forwards`;
        
        document.body.appendChild(coin);
        setTimeout(() => coin.remove(), 600);
    }
}

// 显示连击
function showCombo(count, x, y) {
    const comboDiv = document.createElement('div');
    comboDiv.className = 'combo-text';
    comboDiv.textContent = `${count} 连抓！`;
    comboDiv.style.left = (x + 50) + 'px';
    comboDiv.style.top = (y - 50) + 'px';
    document.body.appendChild(comboDiv);
    
    setTimeout(() => comboDiv.remove(), 800);
}

// 更新统计显示
function updateStats() {
    document.getElementById('packet-count').textContent = collectedCount;
    document.getElementById('total-amount').textContent = '¥' + totalAmount.toFixed(2);
}

// ==================== 手势识别 ====================
async function initHandTracking() {
    console.log('正在初始化 MediaPipe Hands...');
    
    hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });
    
    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.3
    });
    
    hands.onResults(onHandResults);
    
    console.log('MediaPipe Hands 初始化完成');
}

function onHandResults(results) {
    // 清除画布
    handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // 绘制手部关键点
        drawHandLandmarks(landmarks);
        
        // 计算手势值（握拳程度）
        targetGestureValue = 1 - calculateHandOpenness(landmarks);
        
        // 更新手的位置 (使用手掌中心)
        handPosition.x = landmarks[9].x; // 中指根部
        handPosition.y = landmarks[9].y;
        
        // 判断是否在抓取
        const wasGrabbing = isGrabbing;
        isGrabbing = targetGestureValue > CONFIG.grabThreshold;
        
        // 更新 UI
        updateGestureUI(isGrabbing);
        
        // 如果刚开始抓取，重置连击
        if (isGrabbing && !wasGrabbing) {
            comboCount = 0;
        }
        
        // 尝试抓取红包
        if (isGrabbing) {
            tryGrabPackets();
        }
    } else {
        updateGestureUI(false);
        isGrabbing = false;
    }
}

function drawHandLandmarks(landmarks) {
    const color = isGrabbing ? '#ffd700' : '#ff4444';
    handCtx.fillStyle = color;
    handCtx.strokeStyle = color;
    handCtx.lineWidth = 2;
    
    // 绘制连接线
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [9, 10], [10, 11], [11, 12],
        [0, 13], [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20],
        [5, 9], [9, 13], [13, 17]
    ];
    
    handCtx.beginPath();
    connections.forEach(([i, j]) => {
        const x1 = landmarks[i].x * handCanvas.width;
        const y1 = landmarks[i].y * handCanvas.height;
        const x2 = landmarks[j].x * handCanvas.width;
        const y2 = landmarks[j].y * handCanvas.height;
        handCtx.moveTo(x1, y1);
        handCtx.lineTo(x2, y2);
    });
    handCtx.stroke();
    
    // 绘制关键点
    landmarks.forEach((landmark, index) => {
        const x = landmark.x * handCanvas.width;
        const y = landmark.y * handCanvas.height;
        handCtx.beginPath();
        handCtx.arc(x, y, index === 0 ? 5 : 3, 0, 2 * Math.PI);
        handCtx.fill();
    });
}

function calculateHandOpenness(landmarks) {
    const palm = landmarks[0];
    const fingertips = [4, 8, 12, 16, 20];
    
    let totalDistance = 0;
    fingertips.forEach(index => {
        const tip = landmarks[index];
        const dx = tip.x - palm.x;
        const dy = tip.y - palm.y;
        const dz = tip.z - palm.z;
        totalDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
    });
    
    const minDist = 0.3;
    const maxDist = 0.8;
    const normalized = (totalDistance / 5 - minDist) / (maxDist - minDist);
    
    return Math.max(0, Math.min(1, normalized));
}

function updateGestureUI(grabbing) {
    const indicator = document.getElementById('gesture-indicator');
    const gestureIcon = indicator.querySelector('.gesture-icon');
    const gestureText = indicator.querySelector('.gesture-text');
    const grabHint = document.getElementById('grab-hint');
    
    if (grabbing) {
        indicator.classList.add('grabbing');
        gestureIcon.textContent = '✊';
        gestureText.textContent = '抓取中！';
        grabHint.classList.remove('hidden');
    } else {
        indicator.classList.remove('grabbing');
        gestureIcon.textContent = '🖐️';
        gestureText.textContent = '准备抓取';
        grabHint.classList.add('hidden');
    }
}

// 视频帧处理循环
let frameLoopId = null;
let isProcessingFrame = false;

async function processVideoFrame() {
    if (!isCameraActive || !hands || !videoElement.videoWidth) {
        frameLoopId = requestAnimationFrame(processVideoFrame);
        return;
    }
    
    if (!isProcessingFrame) {
        isProcessingFrame = true;
        try {
            await hands.send({ image: videoElement });
        } catch (e) {
            console.error('处理视频帧失败:', e);
        }
        isProcessingFrame = false;
    }
    
    frameLoopId = requestAnimationFrame(processVideoFrame);
}

async function startCamera() {
    try {
        // 初始化手势追踪
        if (!hands) {
            await initHandTracking();
        }
        
        // 获取摄像头流
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                width: 640, 
                height: 480,
                facingMode: 'user'
            }
        });
        
        videoElement.srcObject = stream;
        
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => resolve();
        });
        
        await videoElement.play();
        
        handCanvas.width = videoElement.videoWidth || 640;
        handCanvas.height = videoElement.videoHeight || 480;
        
        isCameraActive = true;
        
        // 开始视频帧处理
        processVideoFrame();
        
        // 开始红包雨
        startRedPacketRain();
        
        console.log('摄像头已启动，开始红包雨！');
        
    } catch (error) {
        console.error('摄像头启动失败:', error);
        alert('无法访问摄像头，请确保已授予权限。');
    }
}

function stopCamera() {
    if (frameLoopId) {
        cancelAnimationFrame(frameLoopId);
        frameLoopId = null;
    }
    
    if (videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
    }
    
    handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
    isCameraActive = false;
    
    stopRedPacketRain();
}

// ==================== 动画循环 ====================
function animate() {
    requestAnimationFrame(animate);
    
    // 平滑过渡手势值
    gestureValue += (targetGestureValue - gestureValue) * 0.15;
    
    // 更新所有红包
    redPackets.forEach(packet => packet.update());
    
    renderer.render(scene, camera);
}

// ==================== 事件监听 ====================
function setupEventListeners() {
    // 开始按钮 - 显示摄像头权限弹窗
    document.getElementById('start-btn').addEventListener('click', () => {
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('camera-modal').classList.remove('hidden');
    });
    
    // 摄像头弹窗 - 确认按钮
    document.getElementById('confirm-camera').addEventListener('click', async () => {
        document.getElementById('camera-modal').classList.add('hidden');
        document.getElementById('restart-btn').classList.remove('hidden');
        await startCamera();
    });
    
    // 摄像头弹窗 - 取消按钮
    document.getElementById('cancel-camera').addEventListener('click', () => {
        document.getElementById('camera-modal').classList.add('hidden');
        document.getElementById('start-screen').classList.remove('hidden');
    });
    
    // 点击弹窗外部关闭
    document.getElementById('camera-modal').addEventListener('click', (e) => {
        if (e.target.id === 'camera-modal') {
            document.getElementById('camera-modal').classList.add('hidden');
            document.getElementById('start-screen').classList.remove('hidden');
        }
    });
    
    // 重新开始按钮
    document.getElementById('restart-btn').addEventListener('click', () => {
        // 重置统计
        collectedCount = 0;
        totalAmount = 0;
        comboCount = 0;
        updateStats();
        
        // 重置所有红包
        redPackets.forEach(packet => packet.reset());
    });
    
    // 全屏按钮
    document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);
    
    // ESC 键关闭弹窗或退出全屏
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('camera-modal');
            if (!modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
                document.getElementById('start-screen').classList.remove('hidden');
            } else if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        }
    });
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log('全屏模式不可用');
        });
    } else {
        document.exitFullscreen();
    }
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -window.innerWidth / 2;
    camera.right = window.innerWidth / 2;
    camera.top = window.innerHeight / 2;
    camera.bottom = -window.innerHeight / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ==================== 启动 ====================
document.addEventListener('DOMContentLoaded', init);
