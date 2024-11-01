import express, { Request, Response } from 'express';
import { getTransactions } from './transactionList';
import { getTransactionCount } from './transactionCount';
import { getTransactionsSortedByValue } from './transactionListByValue';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/transactions', async (req: Request, res: Response) => {
  const { address, page = 1, limit = 10 } = req.query;

  if (!address) {
    return res.status(400).json({ error: "Address is required" });
  }

  try {
    const transactions = await getTransactions(address as string, Number(page), Number(limit));
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: "Error retrieving transactions" });
  }
});

app.get('/transaction-count', async (req: Request, res: Response) => {
  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: "Address is required" });
  }

  try {
    const count = await getTransactionCount(address as string);
    res.json({ address, transactionCount: count });
  } catch (error) {
    res.status(500).json({ error: "Error retrieving transaction count" });
  }
});

app.get('/transactions-by-value', async (req: Request, res: Response) => {
  const { address, page = 1, limit = 10 } = req.query;

  if (!address) {
    return res.status(400).json({ error: "Address is required" });
  }

  try {
    const transactions = await getTransactionsSortedByValue(address as string, Number(page), Number(limit));
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: "Error retrieving transactions sorted by value" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
