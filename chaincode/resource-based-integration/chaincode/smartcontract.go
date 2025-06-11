package chaincode

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type SmartContract struct {
	contractapi.Contract
}

type BatchResource struct {
	ID              string   `json:"id"`
	BatchID         string   `json:"batchId"`
	ActorID         string   `json:"actorId"`
	Step            string   `json:"step"`
	ProductName     string   `json:"productName"`
	ProductCategory string   `json:"productCategory"`
	Timestamp       string   `json:"timestamp"`
	ParentBatches   []string `json:"parentBatches"`
	AttachmentRefs  []string `json:"attachmentRefs"`
}

func (s *SmartContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	batches := []BatchResource{
		{
			ID:              "batch1",
			BatchID:         "BARREL0001",
			ActorID:         "WINEPRODUCER01",
			Step:            "WINEPRODUCTION001",
			ProductName:     "Malvasia DOC",
			ProductCategory: "Malvasia",
			Timestamp:       time.Now().Format(time.RFC3339),
			ParentBatches:   []string{"GRAPEGROWER01_GRAPES0001"},
			AttachmentRefs: []string{
				"QmZ1234567890abcdef1234567890abcdef1234567890abcd",
				"QmZ0987654321fedcba0987654321fedcba0987654321fedc",
			},
		},
	}

	for _, batch := range batches {
		batchJSON, err := json.Marshal(batch)
		if err != nil {
			return err
		}

		err = ctx.GetStub().PutState(batch.ID, batchJSON)
		if err != nil {
			return fmt.Errorf("failed to put to world state: %v", err)
		}
	}

	return nil
}

func (s *SmartContract) CreateBatch(ctx contractapi.TransactionContextInterface, id string, batchID string,
	actorID string, step string, productName string, productCategory string,
	timestamp string, parentBatchesJSON string, attachmentRefsJSON string) error {

	exists, err := s.BatchExists(ctx, id)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("the batch %s already exists", id)
	}

	var parentBatches []string
	if parentBatchesJSON != "" {
		err = json.Unmarshal([]byte(parentBatchesJSON), &parentBatches)
		if err != nil {
			return fmt.Errorf("failed to unmarshal parent batches: %v", err)
		}
	}

	var attachmentRefs []string
	if attachmentRefsJSON != "" {
		err = json.Unmarshal([]byte(attachmentRefsJSON), &attachmentRefs)
		if err != nil {
			return fmt.Errorf("failed to unmarshal attachment refs: %v", err)
		}
	}

	batch := BatchResource{
		ID:              id,
		BatchID:         batchID,
		ActorID:         actorID,
		Step:            step,
		ProductName:     productName,
		ProductCategory: productCategory,
		Timestamp:       timestamp,
		ParentBatches:   parentBatches,
		AttachmentRefs:  attachmentRefs,
	}

	batchJSON, err := json.Marshal(batch)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, batchJSON)
}

func (s *SmartContract) BatchExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	batchJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return false, fmt.Errorf("failed to read from world state: %v", err)
	}

	return batchJSON != nil, nil
}

func (s *SmartContract) ReadBatch(ctx contractapi.TransactionContextInterface, id string) (*BatchResource, error) {
	batchJSON, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("failed to read from world state: %v", err)
	}
	if batchJSON == nil {
		return nil, fmt.Errorf("the batch %s does not exist", id)
	}

	var batch BatchResource
	err = json.Unmarshal(batchJSON, &batch)
	if err != nil {
		return nil, err
	}

	return &batch, nil
}

func (s *SmartContract) AddAttachmentRef(ctx contractapi.TransactionContextInterface, id string, ipfsHash string) error {
	batch, err := s.ReadBatch(ctx, id)
	if err != nil {
		return err
	}

	batch.AttachmentRefs = append(batch.AttachmentRefs, ipfsHash)
	batchJSON, err := json.Marshal(batch)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(id, batchJSON)
}

func (s *SmartContract) QueryBatchesByActor(ctx contractapi.TransactionContextInterface, actorID string) ([]*BatchResource, error) {
	queryString := fmt.Sprintf(`{"selector":{"actorId":"%s"}}`, actorID)
	return s.QueryBatches(ctx, queryString)
}

func (s *SmartContract) QueryBatchesByProductCategory(ctx contractapi.TransactionContextInterface, productCategory string) ([]*BatchResource, error) {
	queryString := fmt.Sprintf(`{"selector":{"productCategory":"%s"}}`, productCategory)
	return s.QueryBatches(ctx, queryString)
}

func (s *SmartContract) QueryBatches(ctx contractapi.TransactionContextInterface, queryString string) ([]*BatchResource, error) {
	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, err
	}
	defer resultsIterator.Close()

	var batches []*BatchResource
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var batch BatchResource
		err = json.Unmarshal(queryResult.Value, &batch)
		if err != nil {
			return nil, err
		}
		batches = append(batches, &batch)
	}

	return batches, nil
}
