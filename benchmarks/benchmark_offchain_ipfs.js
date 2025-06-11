const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

const channelName = 'supplychainnet';
const chaincodeName = 'resource-based'; 
const walletPath = path.join(__dirname, '..', 'wallet'); 
const mspOrg1 = 'Org1MSP';
const org1UserId = 'admin'; 

const testFilesDir = path.join(__dirname, '..', 'test_files_for_benchmark');
const filesToTest = [
    { name: 'file_100KB.bin', size: '100KB' },
    { name: 'file_200KB.bin', size: '200KB' },
    { name: 'file_500KB.bin', size: '500KB' },
    { name: 'file_1MB.bin', size: '1MB' },
    { name: 'file_2MB.bin', size: '2MB' },
    { name: 'file_3MB.bin', size: '3MB' },
    { name: 'file_5MB.bin', size: '5MB' },
    { name: 'file_10MB.bin', size: '10MB' },
    { name: 'file_15MB.bin', size: '15MB' },
    { name: 'file_20MB.bin', size: '20MB' },
    { name: 'file_25MB.bin', size: '25MB' },
    { name: 'file_30MB.bin', size: '30MB' },
    { name: 'file_40MB.bin', size: '40MB' },
    { name: 'file_50MB.bin', size: '50MB' },
    { name: 'file_75MB.bin', size: '75MB' },
    { name: 'file_100MB.bin', size: '100MB' },
    { name: 'file_200MB.bin', size: '200MB' },
    { name: 'file_300MB.bin', size: '300MB' },
    { name: 'file_400MB.bin', size: '400MB' },
    { name: 'file_500MB.bin', size: '500MB' },
];

const numInvocations = 10; 

let ipfs;

async function connectToGateway() {
    const ccpPath = path.resolve(__dirname, '..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: org1UserId, discovery: { enabled: true, asLocalhost: true } });
    return gateway;
}

async function main() {
    const ipfsHttpClient = await import('ipfs-http-client');
    ipfs = ipfsHttpClient.create(); 
    console.log('Successfully connected to IPFS daemon.');

    let gateway;
    try {
        gateway = await connectToGateway();
        const network = await gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);

        console.log('--- Starting Off-Chain IPFS Storage Benchmark ---');
        const results = [];

        for (const fileInfo of filesToTest) {
            const filePath = path.join(testFilesDir, fileInfo.name);
            if (!fs.existsSync(filePath)) {
                console.warn(`File ${fileInfo.name} not found at ${filePath}. Skipping.`);
                continue;
            }
            const fileContent = fs.readFileSync(filePath);
            
            console.log(`
--- Testing file: ${fileInfo.name} (${fileInfo.size}) ---`);

            let totalIpfsAddTime = 0;
            let totalWriteTime = 0;
            let totalReadTime = 0;
            let ipfsHash = null;
            const batchId = `ipfs-${fileInfo.size}-${Date.now()}`;

            for (let i = 0; i < numInvocations; i++) {
                const startTime = process.hrtime.bigint();
                try {
                    const addResult = await ipfs.add(fileContent);
                    ipfsHash = addResult.cid.toString(); 
                    const endTime = process.hrtime.bigint();
                    totalIpfsAddTime += Number(endTime - startTime);
                } catch (error) {
                    console.error(`Error adding ${fileInfo.name} to IPFS (invocation ${i+1}): ${error}`);
                    totalIpfsAddTime = -1; 
                    break;
                }
            }
            const avgIpfsAddTime = totalIpfsAddTime > 0 ? (totalIpfsAddTime / numInvocations / 1e6).toFixed(2) : 'N/A (Error)';

            if (totalIpfsAddTime < 0 || !ipfsHash) {
                console.error(`Skipping Fabric transactions for ${fileInfo.name} due to IPFS error.`);
                results.push({
                    file: fileInfo.name,
                    size: fileInfo.size,
                    avgIpfsAddTimeMs: avgIpfsAddTime,
                    avgWriteTimeMs: 'N/A (IPFS Error)',
                    avgReadTimeMs: 'N/A (IPFS Error)',
                });
                continue;
            }

            const writePromises = [];
            const writeTimings = [];
            for (let i = 0; i < numInvocations; i++) {
                const currentBatchId = `${batchId}-write-${i}`;
                const startTime = process.hrtime.bigint();
                const promise = contract.submitTransaction('CreateBatch',
                    currentBatchId,
                    `BARREL-IPFS-${i}`,
                    'BENCHMARK_ACTOR',
                    'BENCHMARK_STEP',
                    `Product for ${fileInfo.name}`,
                    'BenchmarkCategory',
                    new Date().toISOString(),
                    '[]',
                    JSON.stringify([ipfsHash])
                ).then(() => {
                    const endTime = process.hrtime.bigint();
                    writeTimings[i] = Number(endTime - startTime);
                    console.log(`Write ${i + 1}/${numInvocations} for ${fileInfo.name} (IPFS hash: ${ipfsHash}) committed. Batch ID: ${currentBatchId}`);
                }).catch((error) => {
                    writeTimings[i] = null;
                    console.error(`Error during CreateBatch (IPFS) for ${fileInfo.name} (invocation ${i+1}): ${error}`);
                });
                writePromises.push(promise);
            }
            await Promise.all(writePromises);
            if (writeTimings.some(t => t === null)) {
                totalWriteTime = -1;
            } else {
                totalWriteTime = writeTimings.reduce((a, b) => a + b, 0);
            }
            const avgWriteTime = totalWriteTime > 0 ? (totalWriteTime / numInvocations / 1e6).toFixed(2) : 'N/A (Error)';

            if (totalWriteTime > 0) { 
                const lastWrittenBatchId = `${batchId}-write-${numInvocations - 1}`;
                for (let i = 0; i < numInvocations; i++) {
                    const startTime = process.hrtime.bigint();
                    try {
                        const result = await contract.evaluateTransaction('ReadBatch', lastWrittenBatchId);
                        
                        const endTime = process.hrtime.bigint();
                        totalReadTime += Number(endTime - startTime);
                    } catch (error) {
                         console.error(`Error during ReadBatch (IPFS) for ${fileInfo.name} (invocation ${i+1}): ${error}`);
                         totalReadTime = -1; 
                         break;
                    }
                }
            }
            const avgReadTime = totalReadTime > 0 ? (totalReadTime / numInvocations / 1e6).toFixed(2) : 'N/A (Write failed or read error)';

            results.push({
                file: fileInfo.name,
                size: fileInfo.size,
                avgIpfsAddTimeMs: avgIpfsAddTime,
                avgWriteTimeMs: avgWriteTime,
                avgReadTimeMs: avgReadTime,
            });
            console.log(`Avg IPFS Add Time for ${fileInfo.name}: ${avgIpfsAddTime} ms`);
            console.log(`Avg Write Time (IPFS hash) for ${fileInfo.name}: ${avgWriteTime} ms`);
            console.log(`Avg Read Time (IPFS hash) for ${fileInfo.name}: ${avgReadTime} ms`);
        }

        console.log('\n--- Benchmark Results (Off-Chain IPFS) ---');
        console.table(results);

    } catch (error) {
        console.error(`Failed to run the benchmark: ${error}`);
        process.exit(1);
    } finally {
        if (gateway) {
            gateway.disconnect();
        }
    }
}

main().catch((error) => {
    console.error('Failed to connect to IPFS daemon or run benchmark. Please ensure it is running.');
    console.error(error);
    process.exit(1);
});
