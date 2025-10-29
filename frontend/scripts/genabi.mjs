import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const CONTRACT_NAME = "TimeMaze";
const hardhatRel = "../fhevm-hardhat-template";
const outdir = path.resolve("./abi");

if (!fs.existsSync(outdir)) fs.mkdirSync(outdir);

const hardhatDir = path.resolve(hardhatRel);
const deploymentsDir = path.join(hardhatDir, "deployments");

function ensureLocalhostDeployment() {
  if (process.platform === "win32") return; // skip on windows
  try {
    execSync(`./deploy-hardhat-node.sh`, {
      cwd: path.resolve("./scripts"),
      stdio: "inherit",
    });
  } catch {}
}

function readDeployment(chainName, chainId, optional) {
  const chainDir = path.join(deploymentsDir, chainName);
  if (!fs.existsSync(chainDir)) {
    if (chainId === 31337) ensureLocalhostDeployment();
  }
  if (!fs.existsSync(chainDir)) {
    if (!optional) {
      console.error(`Missing deployments for ${chainName}. Run 'npx hardhat deploy --network ${chainName}' in ${hardhatRel}`);
      process.exit(1);
    }
    return undefined;
  }
  const json = JSON.parse(
    fs.readFileSync(path.join(chainDir, `${CONTRACT_NAME}.json`), "utf-8")
  );
  json.chainId = chainId;
  return json;
}

let sepolia = readDeployment("sepolia", 11155111, false);
let localhost = readDeployment("localhost", 31337, true);
if (!localhost) {
  localhost = { abi: sepolia.abi, address: "0x0000000000000000000000000000000000000000" };
}

// Always prefer Sepolia ABI to avoid localhost reusing older deployments without new methods
const abiTs = `
/* auto-generated */
export const ${CONTRACT_NAME}ABI = ${JSON.stringify({ abi: sepolia.abi }, null, 2)} as const;
`;

const addrTs = `
/* auto-generated */
export const ${CONTRACT_NAME}Addresses = {
  "11155111": { address: "${sepolia.address}", chainId: 11155111, chainName: "sepolia" },
  "31337": { address: "${localhost.address}", chainId: 31337, chainName: "hardhat" }
} as const;
`;

fs.writeFileSync(path.join(outdir, `${CONTRACT_NAME}ABI.ts`), abiTs, "utf-8");
fs.writeFileSync(path.join(outdir, `${CONTRACT_NAME}Addresses.ts`), addrTs, "utf-8");
console.log("Generated ABI and addresses for", CONTRACT_NAME);


