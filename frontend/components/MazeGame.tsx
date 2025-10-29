"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface MazeGameProps {
  onComplete: (timeMs: number) => void;
}

export default function MazeGame({ onComplete }: MazeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [playerPos, setPlayerPos] = useState({ x: 1, y: 1 });
  const [maze, setMaze] = useState<number[][]>([]);
  const mazeRef = useRef<number[][]>([]);
  const playerPosRef = useRef({ x: 1, y: 1 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const CELL_SIZE = 30;
  const MAZE_SIZE = 15;

  // 生成迷宫（深度优先搜索算法）
  const generateMaze = useCallback(() => {
    const size = MAZE_SIZE;
    const grid: number[][] = Array(size).fill(0).map(() => Array(size).fill(1)); // 1=墙 0=路
    
    const directions = [[0, 2], [2, 0], [0, -2], [-2, 0]];
    
    const carve = (x: number, y: number) => {
      grid[y][x] = 0;
      
      const dirs = directions.sort(() => Math.random() - 0.5);
      
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1 && grid[ny][nx] === 1) {
          grid[y + dy / 2][x + dx / 2] = 0;
          carve(nx, ny);
        }
      }
    };
    
    carve(1, 1);
    grid[1][1] = 0; // 起点
    grid[size - 2][size - 2] = 0; // 终点
    
    return grid;
  }, []);

  // 渲染迷宫
  const drawMaze = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mazeData = mazeRef.current;
    if (!mazeData.length) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制迷宫墙
    for (let y = 0; y < mazeData.length; y++) {
      for (let x = 0; x < mazeData[y].length; x++) {
        if (mazeData[y][x] === 1) {
          ctx.fillStyle = "#667eea";
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          ctx.strokeStyle = "#4895ef";
          ctx.lineWidth = 1;
          ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        } else {
          ctx.fillStyle = "#0a0e27";
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }

    // 绘制终点
    const endX = MAZE_SIZE - 2;
    const endY = MAZE_SIZE - 2;
    ctx.fillStyle = "#4ade80";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#4ade80";
    ctx.fillRect(endX * CELL_SIZE + 5, endY * CELL_SIZE + 5, CELL_SIZE - 10, CELL_SIZE - 10);
    ctx.shadowBlur = 0;

    // 绘制玩家
    const { x, y } = playerPosRef.current;
    ctx.fillStyle = "#f093fb";
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#f093fb";
    ctx.beginPath();
    ctx.arc(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [CELL_SIZE, MAZE_SIZE]);

  // 检查是否到达终点
  const checkWin = useCallback(() => {
    const { x, y } = playerPosRef.current;
    if (x === MAZE_SIZE - 2 && y === MAZE_SIZE - 2) {
      setIsPlaying(false);
      if (timerRef.current) clearInterval(timerRef.current);
      const finalTime = Date.now() - startTime;
      onComplete(finalTime);
    }
  }, [MAZE_SIZE, startTime, onComplete]);

  // 处理键盘移动
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isPlaying) return;

    const { x, y } = playerPosRef.current;
    let newX = x;
    let newY = y;

    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        newY = y - 1;
        break;
      case "ArrowDown":
      case "s":
      case "S":
        newY = y + 1;
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        newX = x - 1;
        break;
      case "ArrowRight":
      case "d":
      case "D":
        newX = x + 1;
        break;
      default:
        return;
    }

    e.preventDefault();

    // 检查碰撞
    if (
      newX >= 0 &&
      newX < MAZE_SIZE &&
      newY >= 0 &&
      newY < MAZE_SIZE &&
      mazeRef.current[newY][newX] === 0
    ) {
      playerPosRef.current = { x: newX, y: newY };
      setPlayerPos({ x: newX, y: newY });
      drawMaze();
      checkWin();
    }
  }, [isPlaying, MAZE_SIZE, drawMaze, checkWin]);

  // 开始游戏
  const startGame = useCallback(() => {
    const newMaze = generateMaze();
    mazeRef.current = newMaze;
    setMaze(newMaze);
    playerPosRef.current = { x: 1, y: 1 };
    setPlayerPos({ x: 1, y: 1 });
    setIsPlaying(true);
    const now = Date.now();
    setStartTime(now);
    setElapsedTime(0);

    // 启动计时器
    timerRef.current = setInterval(() => {
      setElapsedTime(Date.now() - now);
    }, 100);
  }, [generateMaze]);

  useEffect(() => {
    drawMaze();
  }, [drawMaze, playerPos, maze]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [handleKeyDown]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${seconds}.${milliseconds.toString().padStart(2, "0")}s`;
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ marginBottom: "1rem", fontSize: "1.5rem", color: "#4895ef" }}>
        ⏱ {formatTime(elapsedTime)}
      </div>
      <div style={{ display: "inline-block", position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={MAZE_SIZE * CELL_SIZE}
          height={MAZE_SIZE * CELL_SIZE}
          style={{
            border: "3px solid #4895ef",
            borderRadius: "8px",
            boxShadow: "0 0 20px rgba(72, 149, 239, 0.5)",
            background: "#0a0e27",
          }}
        />
      </div>
      <div style={{ marginTop: "1.5rem" }}>
        {!isPlaying && (
          <button className="btn" onClick={startGame}>
            🎮 开始游戏
          </button>
        )}
        {isPlaying && (
          <p style={{ color: "#8b9dc3", fontSize: "0.9rem" }}>
            使用方向键或 WASD 移动 | 到达绿色终点完成挑战
          </p>
        )}
      </div>
    </div>
  );
}


