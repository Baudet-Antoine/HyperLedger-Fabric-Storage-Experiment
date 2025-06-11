# HyperLedger Fabric Storage Experiment

## Overview

The goal of this project is to understand the different costs (measured in time) of different storage techniques for Hyperledger Fabric blockchain. The main focus is on comparing on-chain and off-chain (using IPFS) storage.

## Prerequisites

- [Node.js](https://nodejs.org/)
- [npm](https://www.npmjs.com/)
- [Go](https://golang.org/) 
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)
- [Hyperledger Fabric Samples, Binaries, and Docker Images](https://hyperledger-fabric.readthedocs.io/)

## Installation

1. **Clone the repository:**
    ```sh
    git clone https://github.com/Baudet-Antoine/HyperLedger-Fabric-Storage-Experiment.git
    cd HyperLedger-Fabric-Storage-Experiment
    ```

2. **Install Node.js dependencies:**
    ```sh
    npm install
    ```

3. **Install Go dependencies:**
    ```sh
    cd chaincode/resource-based-integration
    go mod vendor
    cd ../resource-based-integration-onchain
    go mod vendor
    cd ../../
    ```

4. **Download Hyperledger Fabric binaries and samples:**
    ```sh
    curl -sSL https://bit.ly/2ysbOFE | bash -s
    ```

5. **Set up the Fabric network:**
    ```sh
    cd fabric-samples/test-network
    ./network.sh up createChannel -c supplychainnet -s couchdb -ca
    ```

6. **Generate or download test files (if needed):**
    ```sh
    for size in $(seq 50 10 250); do
        dd if=/dev/urandom of=testfile_${size}kb.bin bs=1024 count=$size
    done
    ```

## Usage

Once the installation is complete, you will able to use the test-network for this experiment.

first step is to deploy the chaincodes for both organisations.

To deploy a CC on a network, there is multiple steps:

- Package **- Once**
- Install **- For all peers**
- Approve **- For all peers**
- Commit **- Once**

```sh
# Set environment variables for Org1
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=${PWD}/../config/
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

# Package resource-based chaincode
peer lifecycle chaincode package resource-based.tar.gz \
  --path ~/fabric-experiments/chaincode/resource-based-integration \
  --lang golang --label resource-based_1.0 #Change the 1.0 to any version

# Install chaincode on Org1
peer lifecycle chaincode install resource-based.tar.gz
	
# Get package ID (will be needed for the next steps)
peer lifecycle chaincode queryinstalled
# Note the package ID for resource-based_1.0 (something like resource-based_1.0:hash)
export PACKAGE_ID=resource-based_1.0:hash  # Replace with actual package ID

# Approve chaincode for Org1 ⚠️Change the sequence and version accordingly⚠️
peer lifecycle chaincode approveformyorg -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com --channelID supplychainnet \
  --name resource-based --version 1.0 --package-id $PACKAGE_ID \
  --sequence 1 --tls --cafile ${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

# Set environment variables for Org2
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
export CORE_PEER_ADDRESS=localhost:9051

# Install chaincode on Org2
peer lifecycle chaincode install resource-based.tar.gz

# Approve chaincode for Org2 ⚠️Change the sequence and version accordingly⚠️
peer lifecycle chaincode approveformyorg -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com --channelID supplychainnet \
  --name resource-based --version 1.0 --package-id $PACKAGE_ID \
  --sequence 1 --tls --cafile ${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

# Commit chaincode definition ⚠️Change the sequence and version accordingly⚠️
peer lifecycle chaincode commit -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com --channelID supplychainnet \
  --name resource-based --version 1.0 --sequence 1 --tls \
  --cafile ${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem \
  --peerAddresses localhost:7051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
  --peerAddresses localhost:9051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt

# Verify successful deployment
peer lifecycle chaincode querycommitted --channelID supplychainnet --name resource-based --cafile ${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem
```

Then do the same for the second chaincode:

```sh
# Set environment variables for Org1
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=${PWD}/../config/
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

# Package resource-based chaincode
peer lifecycle chaincode package resource-based-onchain.tar.gz \
  --path ~HyperLedger-Fabric-Storage-Experiment/chaincode/resource-based-integration-onchain \
  --lang golang --label resource-based-onchain_1.0 #Change the 1.0 to any version
 
peer lifecycle chaincode package resource-based-onchain.tar.gz \
  --path ../../chaincode/resource-based-integration-onchain \
  --lang golang --label resource-based-onchain_1.0

# Install chaincode on Org1
peer lifecycle chaincode install resource-based-onchain.tar.gz

# Get package ID (will be needed for the next steps)
peer lifecycle chaincode queryinstalled
# Note the package ID for resource-based_1.0 (something like resource-based_1.0:hash)
export PACKAGE_ID=resource-based_1.0:hash  # Replace with actual package ID

# Approve chaincode for Org1 ⚠️Change the sequence and version accordingly⚠️
peer lifecycle chaincode approveformyorg -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com --channelID supplychainnet \
  --name resource-based-onchain --version 1.0 --package-id $PACKAGE_ID \
  --sequence 1 --tls --cafile ${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

# Set environment variables for Org2
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp
export CORE_PEER_ADDRESS=localhost:9051

# Install chaincode on Org2
peer lifecycle chaincode install resource-based-onchain.tar.gz

# Approve chaincode for Org2 ⚠️Change the sequence and version accordingly⚠️
peer lifecycle chaincode approveformyorg -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com --channelID supplychainnet \
  --name resource-based-onchain --version 1.0 --package-id $PACKAGE_ID \
  --sequence 1 --tls --cafile ${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

# Commit chaincode definition ⚠️Change the sequence and version accordingly⚠️
peer lifecycle chaincode commit -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com --channelID supplychainnet \
  --name resource-based-onchain --version 1.0 --sequence 1 --tls \
  --cafile ${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem \
  --peerAddresses localhost:7051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
  --peerAddresses localhost:9051 --tlsRootCertFiles ${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt

# Verify successful deployment
peer lifecycle chaincode querycommitted --channelID supplychainnet --name resource-based-onchain --cafile ${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem
```
You might need to setup an admin user for your network by doing the following:

```sh

cd ~/fabric-experiments/HyperLedger-Fabric-Storage-Experiment/benchmarks

rm -rf ../wallet/admin.id ../wallet/admin
node enrollAdmin.js

cd ../fabric-samples/test-network
./organizations/ccp-generate.sh

docker exec -it cli bash
export CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
peer channel list

export CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
peer channel list

exit
```

You may now start the benchmarks:

```sh
cd benchmarks # move towards the benchmarks files

node benchmark_offchain_ipfs.js

node benchmar_onchain_direct.js
```

## Cleaning Up

To stop and remove the Fabric network:
```sh
cd fabric-samples/test-network
./network.sh down
```

## Notes

- Sensitive or large files (e.g., `node_modules`, `wallet`, test artifacts) are excluded from the repository. Follow the steps above to generate them.
- For troubleshooting, see the [Hyperledger Fabric documentation](https://hyperledger-fabric.readthedocs.io/).
