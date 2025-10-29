"use client";
import "./globals.css";
import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { createFhevmInstance } from "@/fhevm/internal/fhevm";
import { TimeMazeABI } from "@/abi/TimeMazeABI";
import { TimeMazeAddresses } from "@/abi/TimeMazeAddresses";
import MazeGame from "@/components/MazeGame";

export default function Page() {
  const [provider, setProvider] = useState<ethers.Eip1193Provider | undefined>(undefined);
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  const [instance, setInstance] = useState<any>(undefined);
  const [address, setAddress] = useState<string>("");
  const [fhevmStatus, setFhevmStatus] = useState<string>("idle");
  const [message, setMessage] = useState<string>("");
  const [gameCompleted, setGameCompleted] = useState(false);
  const [completedTime, setCompletedTime] = useState<number>(0);
  const [showGame, setShowGame] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (typeof window === "undefined" || !(window as any).ethereum) {
        setMessage("请安装 MetaMask 钱包");
        return;
      }
      const eth = (window as any).ethereum as ethers.Eip1193Provider;
      setProvider(eth);
      
      const idHex = await eth.request({ method: "eth_chainId" });
      const id = typeof idHex === "string" ? parseInt(idHex, 16) : Number(idHex);
      setChainId(id);

      setFhevmStatus("正在初始化 FHEVM...");
      const inst = await createFhevmInstance({
        provider: eth,
        mockChains: { 31337: "http://localhost:8545" },
        onStatusChange: (s) => {
          const statusMap: Record<string, string> = {
            "sdk-loading": "加载 SDK...",
            "sdk-initializing": "初始化 SDK...",
            "creating": "创建实例...",
            "ready": "就绪"
          };
          setFhevmStatus(statusMap[s] || s);
        },
      });
      setInstance(inst);
      setFhevmStatus("就绪");

      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      setAddress(accounts?.[0] ?? "");
      setMessage("FHEVM 实例已创建，可以开始游戏");
    };
    init().catch((e) => {
      setMessage(`初始化失败: ${String(e?.message ?? e)}`);
      setFhevmStatus("错误");
    });
  }, []);

  const contractInfo = useMemo(() => {
    if (!chainId) return {} as any;
    const entry = (TimeMazeAddresses as any)[String(chainId)];
    return entry?.address ? { address: entry.address as `0x${string}`, abi: TimeMazeABI.abi } : ({} as any);
  }, [chainId]);

  const handleGameComplete = async (timeMs: number) => {
    setCompletedTime(timeMs);
    setGameCompleted(true);
    setMessage(`🎉 恭喜通关！用时: ${(timeMs / 1000).toFixed(2)}s\n准备提交加密成绩到链上...`);
    
    // 自动提交成绩
    await submitEncryptedTime(timeMs);
  };

  const submitEncryptedTime = async (ms: number) => {
    if (!instance || !provider || !contractInfo?.address) {
      setMessage("FHEVM 实例或合约地址不可用");
      return;
    }
    try {
      setMessage(`正在加密时间 ${(ms / 1000).toFixed(2)}s...`);
      const signer = await new ethers.BrowserProvider(provider).getSigner();
      const contract = new ethers.Contract(contractInfo.address, contractInfo.abi, signer);

      const input = instance.createEncryptedInput(contractInfo.address, await signer.getAddress());
      input.add64(BigInt(ms));
      const enc = await input.encrypt();

      setMessage("正在提交加密成绩到链上...");
      const tx = await contract.submitResult(enc.handles[0], enc.inputProof);
      setMessage(`交易已发送: ${tx.hash}\n等待确认...`);
      await tx.wait();
      setMessage(`✓ 成绩已成功上链！\ntx: ${tx.hash}\n\n你现在可以铸造 NFT 证明`);
    } catch (e: any) {
      setMessage(`提交失败: ${e?.message ?? e}`);
    }
  };

  const mintProof = async () => {
    if (!instance || !provider || !contractInfo?.address) {
      setMessage("FHEVM 实例或合约地址不可用");
      return;
    }
    try {
      setMessage("正在铸造 NFT 证明...");
      const signer = await new ethers.BrowserProvider(provider).getSigner();
      const contract = new ethers.Contract(contractInfo.address, contractInfo.abi, signer);
      const tx = await contract.mintProof("ipfs://QmYourNFTMetadata");
      setMessage(`铸造交易已发送: ${tx.hash}\n等待确认...`);
      await tx.wait();
      setMessage(`✓ NFT 证明铸造成功！\ntx: ${tx.hash}`);
    } catch (e: any) {
      setMessage(`铸造失败: ${e?.message ?? e}`);
    }
  };

  const canInteract = instance && contractInfo?.address && address;

  const startRunThenStartGame = async () => {
    if (!provider || !contractInfo?.address) {
      setMessage("合约未就绪");
      return;
    }
    try {
      const signer = await new ethers.BrowserProvider(provider).getSigner();
      const contract = new ethers.Contract(contractInfo.address, contractInfo.abi, signer);
      const clientTs = BigInt(Date.now());
      setMessage("开始上链: startRun()...");
      const tx = await contract.startRun(clientTs);
      setMessage(`startRun 交易已发送: ${tx.hash}\n等待确认...`);
      await tx.wait();
      setMessage("✓ startRun 已确认，开始游戏！");
      setShowGame(true);
    } catch (e: any) {
      setMessage(`startRun 失败: ${e?.message ?? e}`);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1 className="title">TIMEMAZE</h1>
        <p className="subtitle">Encrypted On-Chain Speedrun Records</p>
      </div>

      <div className="status-panel">
        <h2 className="status-title">⚡ FHEVM 状态面板</h2>
        <div className="status-grid">
          <div className="status-item">
            <div className="status-label">FHEVM 状态</div>
            <div className={`status-value ${fhevmStatus === '就绪' ? 'ready' : 'loading'}`}>
              {fhevmStatus}
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">钱包地址</div>
            <div className="status-value">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '-'}
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">链 ID</div>
            <div className="status-value">
              {chainId ?? '-'}
            </div>
          </div>
          <div className="status-item">
            <div className="status-label">合约地址</div>
            <div className="status-value">
              {contractInfo?.address 
                ? `${contractInfo.address.slice(0, 6)}...${contractInfo.address.slice(-4)}` 
                : '-'}
            </div>
          </div>
        </div>
        <div className="actions" style={{ marginTop: "1rem" }}>
          <a className="btn" href="/records">📜 查看我的记录与解密</a>
        </div>
      </div>

      {!showGame && (
        <div className="actions">
          <button 
            className="btn" 
            onClick={startRunThenStartGame}
            disabled={!canInteract}
          >
            🎮 开始挑战迷宫
          </button>
        </div>
      )}

      {showGame && (
        <div style={{ marginTop: "2rem" }}>
          <MazeGame onComplete={handleGameComplete} />
        </div>
      )}

      {gameCompleted && (
        <div className="actions">
          <button 
            className="btn" 
            onClick={() => {
              setGameCompleted(false);
              setShowGame(true);
            }}
          >
            🔄 再玩一次
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={mintProof}
            disabled={!canInteract}
          >
            🎨 铸造 NFT 证明
          </button>
        </div>
      )}

      {message && (
        <div className="message-box">
          {message}
        </div>
      )}
    </div>
  );
}
