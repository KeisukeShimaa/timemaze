"use client";
import "../globals.css";
import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { createFhevmInstance } from "@/fhevm/internal/fhevm";
import { TimeMazeABI } from "@/abi/TimeMazeABI";
import { TimeMazeAddresses } from "@/abi/TimeMazeAddresses";

export default function RecordsPage() {
  const [provider, setProvider] = useState<ethers.Eip1193Provider | undefined>(undefined);
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  const [instance, setInstance] = useState<any>(undefined);
  const [address, setAddress] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  type RecordItem = { handle: string; timestamp: number; txHash: string; blockNumber: number };
  const [items, setItems] = useState<RecordItem[]>([]);
  const [decrypting, setDecrypting] = useState<string | undefined>(undefined);
  const [clearByHandle, setClearByHandle] = useState<Record<string, string>>({});

  useEffect(() => {
    const init = async () => {
      if (typeof window === "undefined" || !(window as any).ethereum) return;
      const eth = (window as any).ethereum as ethers.Eip1193Provider;
      setProvider(eth);
      const idHex = await eth.request({ method: "eth_chainId" });
      const id = typeof idHex === "string" ? parseInt(idHex, 16) : Number(idHex);
      setChainId(id);

      const inst = await createFhevmInstance({ provider: eth, mockChains: { 31337: "http://localhost:8545" } });
      setInstance(inst);

      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      setAddress(accounts?.[0] ?? "");
    };
    init().catch((e) => setMessage(String(e?.message ?? e)));
  }, []);

  const contractInfo = useMemo(() => {
    if (!chainId) return {} as any;
    const entry = (TimeMazeAddresses as any)[String(chainId)];
    return entry?.address ? { address: entry.address as `0x${string}`, abi: TimeMazeABI.abi } : ({} as any);
  }, [chainId]);

  const fetchMyRecords = async () => {
    if (!provider || !contractInfo?.address || !address) return;
    try {
      setMessage("正在读取我的历史记录...");
      const rprovider = new ethers.BrowserProvider(provider);
      const abi = new ethers.Interface(TimeMazeABI.abi as any);
      // ethers v6: 直接用 keccak256(event signature) 计算 topic0
      const topic0 = ethers.id("ResultSubmitted(address,bytes32,uint64)");
      const addrTopic = ethers.zeroPadValue(address, 32);
      const logs = await rprovider.getLogs({
        address: contractInfo.address,
        fromBlock: 0n,
        toBlock: "latest",
        topics: [topic0, addrTopic],
      });
      const parsed: RecordItem[] = logs.map((l) => {
        const decoded = abi.decodeEventLog("ResultSubmitted", l.data, l.topics);
        // decoded: [player(indexed), inputHandle, timestamp]
        return {
          handle: decoded.inputHandle as string,
          timestamp: Number(decoded.timestamp),
          txHash: l.transactionHash,
          blockNumber: Number(l.blockNumber),
        };
      }).reverse();
      setItems(parsed);
      setMessage(`共找到 ${parsed.length} 条记录`);
    } catch (e: any) {
      setMessage(`读取失败: ${e?.message ?? e}`);
    }
  };

  const userDecrypt = async (handle: string) => {
    if (!instance || !provider || !contractInfo?.address || !handle) return;
    try {
      setDecrypting(handle);
      const rprovider = new ethers.BrowserProvider(provider);
      const signer = await rprovider.getSigner();

      // 1) 生成临时密钥对
      const { publicKey, privateKey } = instance.generateKeypair();
      const contracts = [contractInfo.address];
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 365;

      // 2) 构建 EIP-712 并签名
      const eip712 = instance.createEIP712(
        publicKey,
        contracts,
        startTimestamp,
        durationDays
      );
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );

      // 3) 解密（可批量，这里单个）
      const res = await instance.userDecrypt(
        [{ handle, contractAddress: contractInfo.address }],
        privateKey,
        publicKey,
        signature,
        contracts,
        await signer.getAddress(),
        startTimestamp,
        durationDays
      );

      const value = res[handle];
      setClearByHandle((prev) => ({ ...prev, [handle]: String(value) }));
      setMessage("解密成功");
    } catch (e: any) {
      setMessage(`解密失败: ${e?.message ?? e}`);
    }
    finally {
      setDecrypting(undefined);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1 className="title">我的成绩</h1>
        <p className="subtitle">查看并解密我在 TimeMaze 的最佳用时</p>
      </div>

      <div className="status-panel">
        <div className="status-grid">
          <div className="status-item">
            <div className="status-label">钱包地址</div>
            <div className="status-value">{address ? `${address.slice(0,6)}...${address.slice(-4)}` : '-'}</div>
          </div>
          <div className="status-item">
            <div className="status-label">链 ID</div>
            <div className="status-value">{chainId ?? '-'}</div>
          </div>
          <div className="status-item">
            <div className="status-label">合约地址</div>
            <div className="status-value">{contractInfo?.address ? `${contractInfo.address.slice(0,6)}...${contractInfo.address.slice(-4)}` : '-'}</div>
          </div>
        </div>
        <div className="actions" style={{ marginTop: "1rem" }}>
          <button className="btn" onClick={fetchMyRecords} disabled={!contractInfo?.address}>读取我的所有记录</button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="status-panel">
          <div className="status-title">📜 我的历史记录</div>
          <div className="status-grid">
            {items.map((it, idx) => (
              <div key={`${it.txHash}-${idx}`} className="status-item">
                <div className="status-label">Tx</div>
                <div className="status-value">{`${it.txHash.slice(0, 8)}...${it.txHash.slice(-6)}`}</div>
                <div className="status-label" style={{ marginTop: 8 }}>时间</div>
                <div className="status-value">{new Date(it.timestamp * 1000).toLocaleString()}</div>
                <div className="status-label" style={{ marginTop: 8 }}>密文句柄</div>
                <div className="status-value">{`${it.handle.slice(0, 10)}...${it.handle.slice(-6)}`}</div>
                <div className="actions" style={{ marginTop: 12 }}>
                  <button className="btn btn-secondary" onClick={() => userDecrypt(it.handle)} disabled={decrypting === it.handle}>
                    {clearByHandle[it.handle] ? `✅ ${(Number(clearByHandle[it.handle]) / 1000).toFixed(2)}s` : decrypting === it.handle ? "解密中..." : "解密此条成绩"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {message && <div className="message-box">{message}</div>}
    </div>
  );
}


