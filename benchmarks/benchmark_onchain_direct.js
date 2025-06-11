const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

const channelName = 'supplychainnet';
const chaincodeName = 'resource-based-onchain'; 
const walletPath = path.join(__dirname, '..', 'wallet'); 
const mspOrg1 = 'Org1MSP';
const org1UserId = 'admin'; 

const testFilesDir = path.join(__dirname, '..', 'test_files_for_benchmark');
const filesToTest = [
    /*{ name: 'file_50KB.bin', size: '50KB' },
    { name: 'file_60KB.bin', size: '60KB' },
    { name: 'file_70KB.bin', size: '70KB' },
    { name: 'file_80KB.bin', size: '80KB' },
    { name: 'file_90KB.bin', size: '90KB' },
    { name: 'file_100KB.bin', size: '100KB' },
    { name: 'file_110KB.bin', size: '110KB' },
    { name: 'file_120KB.bin', size: '120KB' },
    { name: 'file_130KB.bin', size: '130KB' },
    { name: 'file_140KB.bin', size: '140KB' },
    { name: 'file_150KB.bin', size: '150KB' },
    { name: 'file_160KB.bin', size: '160KB' },
    { name: 'file_170KB.bin', size: '170KB' },
    { name: 'file_180KB.bin', size: '180KB' },
    { name: 'file_190KB.bin', size: '190KB' },
    { name: 'file_200KB.bin', size: '200KB' },
    { name: 'file_210KB.bin', size: '210KB' },
    { name: 'file_220KB.bin', size: '220KB' },
    { name: 'file_230KB.bin', size: '230KB' },
    { name: 'file_240KB.bin', size: '240KB' },
    { name: 'file_250KB.bin', size: '250KB' },*/

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

async function connectToGateway() {
    const ccpPath = path.resolve(__dirname, '..', 'fabric-samples', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    const gateway = new Gateway();
    await gateway.connect(ccp, { wallet, identity: org1UserId, discovery: { enabled: true, asLocalhost: true } });
    return gateway;
}

async function main() {
    let gateway;
    try {
        gateway = await connectToGateway();
        const network = await gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);

        console.log('--- Starting On-Chain Direct Storage Benchmark ---');
        const results = [];

        for (const fileInfo of filesToTest) {
            const filePath = path.join(testFilesDir, fileInfo.name);
            if (!fs.existsSync(filePath)) {
                console.warn(`File ${fileInfo.name} not found at ${filePath}. Skipping.`);
                continue;
            }
            const fileContent = fs.readFileSync(filePath);
            const base64Content = fileContent.toString('base64');
            
            console.log(`
--- Testing file: ${fileInfo.name} (${fileInfo.size}) ---`);

            let totalWriteTime = 0;
            let totalReadTime = 0;
            const batchId = `onchain-${fileInfo.size}-${Date.now()}`;

            const writePromises = [];
            const writeTimings = [];
            for (let i = 0; i < numInvocations; i++) {
                const currentBatchId = `${batchId}-write-${i}`;
                const startTime = process.hrtime.bigint();
                const promise = contract.submitTransaction('CreateBatch',
                    currentBatchId, 
                    `BARREL-ONCHAIN-${i}`, 
                    'BENCHMARK_ACTOR', 
                    'BENCHMARK_STEP', 
                    `Product for ${fileInfo.name}`,
                    'BenchmarkCategory',
                    new Date().toISOString(),
                    '[]',
                    JSON.stringify([base64Content])
                ).then(() => {
                    const endTime = process.hrtime.bigint();
                    writeTimings[i] = Number(endTime - startTime);
                    console.log(`Write ${i + 1}/${numInvocations} for ${fileInfo.name} committed. Batch ID: ${currentBatchId}`);
                }).catch((error) => {
                    writeTimings[i] = null;
                    console.error(`Error during CreateBatch for ${fileInfo.name} (invocation ${i+1}): ${error}`);
                    if (error.message && (error.message.includes('ARG_MAX') || error.message.includes('payload is larger than'))) {
                        console.error(`File ${fileInfo.name} is likely too large for this transaction.`);
                    }
                });
                writePromises.push(promise);
            }
            await Promise.all(writePromises);
            if (writeTimings.some(t => t === null)) {
                totalWriteTime = -1;
            } else {
                totalWriteTime = writeTimings.reduce((a, b) => a + b, 0);
            }
            const avgWriteTime = totalWriteTime > 0 ? (totalWriteTime / numInvocations / 1e6).toFixed(2) : 'N/A (Error or too large)';

            if (totalWriteTime > 0) { 
                const lastWrittenBatchId = `${batchId}-write-${numInvocations - 1}`;
                for (let i = 0; i < numInvocations; i++) {
                    const startTime = process.hrtime.bigint();
                    try {
                        const result = await contract.evaluateTransaction('ReadBatch', lastWrittenBatchId);
               
                        const endTime = process.hrtime.bigint();
                        totalReadTime += Number(endTime - startTime);
                    } catch (error) {
                         console.error(`Error during ReadBatch for ${fileInfo.name} (invocation ${i+1}): ${error}`);
                         totalReadTime = -1; 
                         break;
                    }
                }
            }
            const avgReadTime = totalReadTime > 0 ? (totalReadTime / numInvocations / 1e6).toFixed(2) : 'N/A (Write failed or read error)';

            results.push({
                file: fileInfo.name,
                size: fileInfo.size,
                avgWriteTimeMs: avgWriteTime,
                avgReadTimeMs: avgReadTime,
            });
            console.log(`Avg Write Time for ${fileInfo.name}: ${avgWriteTime} ms`);
            console.log(`Avg Read Time for ${fileInfo.name}: ${avgReadTime} ms`);
        }

        console.log('\n--- Benchmark Results (On-Chain Direct) ---');
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

main();
