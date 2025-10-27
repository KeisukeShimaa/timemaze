// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @title TimeMaze - On-chain encrypted speedrun records with FHEVM
/// @notice Stores each player's best (minimal) time in encrypted form and allows controlled decryption
contract TimeMaze is SepoliaConfig, ERC721URIStorage {
    struct Player {
        // Encrypted best time in milliseconds
        euint64 bestTime;
        // Has the player submitted at least once
        bool hasPlayed;
    }

    mapping(address => Player) private _players;
    address[] private _playerList;

    // NFT state
    uint256 public tokenCounter;
    mapping(address => bool) private _minted;

    event ResultSubmitted(address indexed player, externalEuint64 inputHandle, uint64 timestamp);
    event ProofMinted(address indexed player, uint256 indexed tokenId, string uri);
    event RunStarted(address indexed player, uint64 clientTimestamp);

    constructor() ERC721("TimeMaze Proof", "TMZP") {}

    /// @notice Submit a time result (encrypted) with input proof
    /// @dev Only stores the minimal time using homomorphic min
    /// @param timeExt external encrypted u64 time in milliseconds
    /// @param inputProof zero-knowledge input proof
    function submitResult(externalEuint64 timeExt, bytes calldata inputProof) external {
        // turn external handle into internal ciphertext
        euint64 time = FHE.fromExternal(timeExt, inputProof);

        if (!_players[msg.sender].hasPlayed) {
            _players[msg.sender].hasPlayed = true;
            _players[msg.sender].bestTime = time;
            _playerList.push(msg.sender);
        } else {
            // best = min(best, time)
            _players[msg.sender].bestTime = FHE.min(_players[msg.sender].bestTime, time);
        }

        // grant ACL to contract and sender for later decryption
        FHE.allowThis(_players[msg.sender].bestTime);
        FHE.allow(_players[msg.sender].bestTime, msg.sender);

        emit ResultSubmitted(msg.sender, timeExt, uint64(block.timestamp));
    }

    /// @notice Mark the beginning of a run (for transparency / analytics)
    /// @dev This does not store plaintext time as bestTime; only emits an event
    function startRun(uint64 clientTimestamp) external {
        emit RunStarted(msg.sender, clientTimestamp);
    }

    /// @notice Returns the encrypted best time handle for a player
    function getBestTime(address player) external view returns (euint64) {
        require(_players[player].hasPlayed, "No record");
        return _players[player].bestTime;
    }

    /// @notice Mint an NFT proof for the CURRENT best encrypted time (one per address)
    function mintProof(string memory uri) external {
        require(_players[msg.sender].hasPlayed, "No record");
        require(!_minted[msg.sender], "Already minted");

        tokenCounter++;
        _safeMint(msg.sender, tokenCounter);
        _setTokenURI(tokenCounter, uri);

        _minted[msg.sender] = true;
        emit ProofMinted(msg.sender, tokenCounter, uri);
    }

    /// @notice Returns list length
    function playersCount() external view returns (uint256) {
        return _playerList.length;
    }

    /// @notice Paged players list to allow off-chain sorting
    function getPlayers(uint256 offset, uint256 limit) external view returns (address[] memory) {
        uint256 n = _playerList.length;
        if (offset > n) {
            return new address[](0);
        }
        uint256 end = offset + limit;
        if (end > n) end = n;
        uint256 size = end - offset;
        address[] memory out = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            out[i] = _playerList[offset + i];
        }
        return out;
    }
}


