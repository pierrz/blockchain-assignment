import express, { RequestHandler } from "express";
import { getTransactions } from "./transactionList.js";
import { getTransactionCount } from "./transactionCount.js";
import { restartServices, restartDatabase } from "./restartServices.js";

// TRANSACTIONS ENDPOINTS
const handleTransactions: RequestHandler = async (req, res) => {
  const { address, page = "1", limit = "10" } = req.query;

  if (!address) {
    res.status(400).json({ error: "Address is required" });
    return;
  }

  try {
    const transactions = await getTransactions(
      String(address),
      Number(page),
      Number(limit),
    );
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: "Error retrieving transactions" });
  }
};

const handleTransactionsByValue: RequestHandler = async (req, res) => {
  const { address, page = "1", limit = "10" } = req.query;

  if (!address) {
    res.status(400).json({ error: "Address is required" });
    return;
  }

  try {
    const transactionsByValue = await getTransactions(
      String(address),
      Number(page),
      Number(limit),
      true,
    );
    res.json(transactionsByValue);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error retrieving transactions sorted by value" });
  }
};

const handleTransactionCount: RequestHandler = async (req, res) => {
  const { address } = req.query;

  if (!address) {
    res.status(400).json({ error: "Address is required" });
    return;
  }

  try {
    const countResponse = await getTransactionCount(String(address));
    res.json(countResponse);
  } catch (error) {
    res.status(500).json({ error: "Error retrieving transaction count" });
  }
};

// RESTART ENDPOINTS
const handleRestartServices: RequestHandler = async (req, res) => {
  try {
    await restartServices();
  } catch (error) {
    res.status(500).json({ error: "Error restarting services" });
  }
};

const handleRestartDatabase: RequestHandler = async (req, res) => {
  try {
    await restartDatabase();
  } catch (error) {
    res.status(500).json({ error: "Error restarting database" });
  }
};

// WRAP-UP
export async function startAPI(): Promise<void> {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.get("/transactions", handleTransactions);
  app.get("/transactions/by-value", handleTransactionsByValue);
  app.get("/transactions/count", handleTransactionCount);
  app.get("/restart/all", handleRestartServices);
  app.get("/restart/database", handleRestartDatabase);

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}
