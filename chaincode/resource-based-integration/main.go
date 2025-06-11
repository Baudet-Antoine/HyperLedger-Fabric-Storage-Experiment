package main

import (
	"log"

	"resource-based-integration/chaincode"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	smartContract := new(chaincode.SmartContract)

	cc, err := contractapi.NewChaincode(smartContract)
	if err != nil {
		log.Panicf("Error creating resource-based-integration chaincode: %v", err)
	}

	if err := cc.Start(); err != nil {
		log.Panicf("Error starting resource-based-integration chaincode: %v", err)
	}
}
