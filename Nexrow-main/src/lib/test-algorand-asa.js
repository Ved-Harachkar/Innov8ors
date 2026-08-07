import algosdk from 'algosdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const ALGORAND_NODE_URL = process.env.ALGORAND_NODE_URL || 'https://testnet-api.algonode.cloud';
const ASSET_ID_ENV = process.env.VITE_ALGORAND_ASSET_ID;
const CLIENT_MNEMONIC = process.env.TEST_CLIENT_MNEMONIC;
const RECEIVER_ADDRESS = process.env.TEST_RECEIVER_ADDRESS; // Optional receiver to send a test asset to

async function run() {
  console.log('=== ALGORAND TESTNET ASA VERIFICATION ===');
  console.log(`Connecting to node: ${ALGORAND_NODE_URL}`);
  const algodClient = new algosdk.Algodv2('', ALGORAND_NODE_URL, '');

  // 1. Verify VITE_ALGORAND_ASSET_ID is configured
  if (!ASSET_ID_ENV) {
    console.error('\n❌ CONFIGURATION ERROR:');
    console.error('VITE_ALGORAND_ASSET_ID is missing from your .env file.');
    console.error('Please configure it like this:');
    console.error('VITE_ALGORAND_ASSET_ID=<SPONSOR_ASSET_ID>');
    process.exit(1);
  }

  const assetId = parseInt(ASSET_ID_ENV, 10);
  if (isNaN(assetId)) {
    console.error(`\n❌ CONFIGURATION ERROR: VITE_ALGORAND_ASSET_ID "${ASSET_ID_ENV}" is not a valid number.`);
    process.exit(1);
  }

  console.log(`Verifying Asset ID: ${assetId}...`);

  // 2. Query Asset Metadata on-chain
  let assetInfo;
  try {
    assetInfo = await algodClient.getAssetByID(assetId).do();
    const params = assetInfo.params;
    console.log('\n✅ ASA Found on Algorand Testnet:');
    console.log(`- Name: ${params.name || 'Unnamed'}`);
    console.log(`- Unit Name: ${params['unit-name'] || 'N/A'}`);
    console.log(`- Total Supply: ${params.total}`);
    console.log(`- Decimals: ${params.decimals}`);
    console.log(`- Creator: ${params.creator}`);
  } catch (err) {
    console.error(`\n❌ ERROR: Failed to retrieve asset ${assetId} from Algorand Testnet. Node error:`, err.message);
    process.exit(1);
  }

  // 3. Wallet Credentials Check
  let account;
  if (!CLIENT_MNEMONIC) {
    console.log('\n--- WALLET GENERATOR (No TEST_CLIENT_MNEMONIC in .env) ---');
    account = algosdk.generateAccount();
    const mnemonic = algosdk.secretKeyToMnemonic(account.sk);
    console.log('We generated a new test wallet for you:');
    console.log(`- Address: ${account.addr}`);
    console.log(`- Mnemonic: ${mnemonic}`);
    console.log('\nACTION REQUIRED:');
    console.log('1. Go to the Algorand Testnet Dispenser: https://bank.testnet.algorand.network/');
    console.log(`2. Fund this address (${account.addr}) with Testnet ALGO.`);
    console.log('3. Set the following in your .env file:');
    console.log(`TEST_CLIENT_MNEMONIC="${mnemonic}"`);
    console.log('\nOnce done, re-run this script to test Opt-In and Asset Transfer.');
    return;
  } else {
    try {
      account = algosdk.mnemonicToSecretKey(CLIENT_MNEMONIC);
      console.log(`\nUsing configured client wallet: ${account.addr}`);
    } catch (err) {
      console.error('\n❌ ERROR: TEST_CLIENT_MNEMONIC in .env is invalid.', err.message);
      process.exit(1);
    }
  }

  // 4. Fetch Client Balance and Opt-in status
  console.log('\nChecking wallet balances...');
  const accountInfo = await algodClient.accountInformation(account.addr).do();
  const algoBalance = Number(accountInfo.amount) / 1000000;
  console.log(`- ALGO Balance: ${algoBalance} ALGO`);

  if (algoBalance < 0.1) {
    console.error(`\n❌ ERROR: Your wallet has insufficient ALGO (${algoBalance} ALGO).`);
    console.error('Please fund your wallet at https://bank.testnet.algorand.network/ first.');
    process.exit(1);
  }

  // Check if opted in to the asset
  const assets = accountInfo.assets || [];
  const optedIn = assets.some(a => Number(a['asset-id']) === assetId);

  // 5. Opt-in to ASA if not already opted in
  if (!optedIn) {
    console.log(`\nWallet ${account.addr} is not opted in to ASA ${assetId}. Initiating opt-in...`);
    const params = await algodClient.getTransactionParams().do();
    // Opt-in is an Asset Transfer transaction of 0 amount to self
    const optInTx = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: account.addr,
      receiver: account.addr,
      assetIndex: assetId,
      amount: 0,
      suggestedParams: params,
    });

    const signedTx = optInTx.signTxn(account.sk);
    const txId = optInTx.txID();
    await algodClient.sendRawTransaction(signedTx).do();
    console.log(`Opt-in transaction submitted. TxID: ${txId}`);
    
    console.log('Waiting for confirmation...');
    const confirmedTx = await algosdk.waitForConfirmation(algodClient, txId, 4);
    console.log(`✅ Opt-in Confirmed in round ${confirmedTx['confirmed-round']}`);
  } else {
    const matchingAsset = assets.find(a => Number(a['asset-id']) === assetId);
    const assetBalance = matchingAsset ? Number(matchingAsset.amount) : 0;
    console.log(`✅ Wallet already opted in to ASA ${assetId}. Current ASA Balance: ${assetBalance}`);
  }

  // 6. Real Asset Transfer Check
  let rxAddress = RECEIVER_ADDRESS;
  let rxSecretKey = null;

  if (!rxAddress) {
    console.log('\n--- DYNAMIC RECEIVER GENERATOR ---');
    const rxAccount = algosdk.generateAccount();
    rxAddress = rxAccount.addr;
    rxSecretKey = rxAccount.sk;
    console.log(`Generated temporary receiver: ${rxAddress}`);

    // Fund receiver with 0.2 ALGO for MBR and fees
    console.log('Funding temporary receiver with 0.2 ALGO...');
    const params = await algodClient.getTransactionParams().do();
    const fundTx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: account.addr,
      receiver: rxAddress,
      amount: 300000, // 0.3 ALGO (0.2 ALGO MBR + fees)
      suggestedParams: params,
    });
    const signedFund = fundTx.signTxn(account.sk);
    const fundTxId = fundTx.txID();
    await algodClient.sendRawTransaction(signedFund).do();
    await algosdk.waitForConfirmation(algodClient, fundTxId, 4);
    console.log(`✅ Funded temporary receiver. TxID: ${fundTxId}`);

    // Opt-in receiver to the ASA
    console.log(`Opting temporary receiver in to ASA ${assetId}...`);
    const optInParams = await algodClient.getTransactionParams().do();
    const rxOptInTx = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: rxAddress,
      receiver: rxAddress,
      assetIndex: assetId,
      amount: 0,
      suggestedParams: optInParams,
    });
    const signedRxOptIn = rxOptInTx.signTxn(rxSecretKey);
    const rxOptInTxId = rxOptInTx.txID();
    await algodClient.sendRawTransaction(signedRxOptIn).do();
    await algosdk.waitForConfirmation(algodClient, rxOptInTxId, 4);
    console.log(`✅ Temporary receiver opted in. TxID: ${rxOptInTxId}`);
  }

  console.log(`\nAttempting real Asset Transfer of 1 unit of ASA ${assetId} to ${rxAddress}...`);
  const params = await algodClient.getTransactionParams().do();
  const xferTx = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: account.addr,
    receiver: rxAddress,
    assetIndex: assetId,
    amount: 1, // sending 1 unit (0.000001 USDC since decimals = 6)
    suggestedParams: params,
  });

  const signedXfer = xferTx.signTxn(account.sk);
  const xferTxId = xferTx.txID();
  await algodClient.sendRawTransaction(signedXfer).do();
  console.log(`Asset Transfer transaction submitted. TxID: ${xferTxId}`);
  
  console.log('Waiting for confirmation...');
  const confirmedXfer = await algosdk.waitForConfirmation(algodClient, xferTxId, 4);
  console.log(`✅ Transfer Confirmed in round ${confirmedXfer['confirmed-round']}`);
  console.log(`Verify here: https://testnet.algoscan.app/tx/${xferTxId}`);
}

run().catch(err => {
  console.error('\n❌ UNEXPECTED ERROR IN EXECUTION:', err);
});
