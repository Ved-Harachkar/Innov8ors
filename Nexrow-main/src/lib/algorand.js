import algosdk from 'algosdk';

// Browser-compatible base64 to Uint8Array helper (works without Buffer)
function base64ToUint8Array(base64String) {
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Escrow Smart Contract TEAL Approval Program
const approvalTeal = `#pragma version 8
// Handle creation
txn ApplicationID
int 0
==
bnz handle_create

// Handle delete/update
txn OnCompletion
int UpdateApplication
==
txn OnCompletion
int DeleteApplication
==
||
bnz handle_admin

// Handle normal calls
txn OnCompletion
int NoOp
==
assert

txna ApplicationArgs 0
byte "opt_in"
==
bnz handle_opt_in

txna ApplicationArgs 0
byte "release"
==
bnz handle_release

txna ApplicationArgs 0
byte "refund"
==
bnz handle_refund

txna ApplicationArgs 0
byte "dispute"
==
bnz handle_dispute

err

handle_create:
// Store the client address (txn Sender) in global state "client"
byte "client"
txn Sender
app_global_put

// Store the freelancer address in global state "freelancer"
byte "freelancer"
txna ApplicationArgs 0
app_global_put

// Store the asset ID in global state "asset_id"
byte "asset_id"
txna ApplicationArgs 1
btoi
app_global_put

// Set disputed to 0 initially
byte "disputed"
int 0
app_global_put

int 1
return

handle_admin:
// Only client can update or delete
txn Sender
byte "client"
app_global_get
==
return

handle_opt_in:
// Allow the contract account to opt in to the asset
txn Sender
byte "client"
app_global_get
==
assert

itxn_begin
int axfer
itxn_field TypeEnum
byte "asset_id"
app_global_get
itxn_field XferAsset
global CurrentApplicationAddress
itxn_field AssetReceiver
int 0
itxn_field AssetAmount
itxn_submit

int 1
return

handle_release:
// Release funds to the freelancer
// Must be called by the client
txn Sender
byte "client"
app_global_get
==
assert

// Ensure not disputed
byte "disputed"
app_global_get
int 0
==
assert

itxn_begin
int axfer
itxn_field TypeEnum
byte "asset_id"
app_global_get
itxn_field XferAsset
byte "freelancer"
app_global_get
itxn_field AssetReceiver
txna ApplicationArgs 1
btoi
itxn_field AssetAmount
itxn_submit

int 1
return

handle_refund:
// Refund funds to the client
// Must be called by the client
txn Sender
byte "client"
app_global_get
==
assert

// Ensure not disputed
byte "disputed"
app_global_get
int 0
==
assert

itxn_begin
int axfer
itxn_field TypeEnum
byte "asset_id"
app_global_get
itxn_field XferAsset
byte "client"
app_global_get
itxn_field AssetReceiver
txna ApplicationArgs 1
btoi
itxn_field AssetAmount
itxn_submit

int 1
return

handle_dispute:
// Must be called by the client or freelancer
txn Sender
byte "client"
app_global_get
==
txn Sender
byte "freelancer"
app_global_get
==
||
assert

// Set disputed to 1
byte "disputed"
int 1
app_global_put

int 1
return
`;

const clearTeal = `#pragma version 8
int 1
return
`;

class AlgorandServiceClass {
  constructor() {
    this.network = import.meta.env.VITE_ALGORAND_NETWORK || 'testnet';
    this.nodeUrl = import.meta.env.VITE_ALGORAND_NODE_URL || 'https://testnet-api.algonode.cloud';
    this.assetId = parseInt(import.meta.env.VITE_ALGORAND_ASSET_ID || '10458941', 10);
    this.algodClient = new algosdk.Algodv2('', this.nodeUrl, '');
    
    this.clientWallet = null;
    this.freelancerWallet = null;
    this.initWallets();
  }

  initWallets() {
    const clientMnemonic = import.meta.env.VITE_TEST_CLIENT_MNEMONIC;
    const freelancerMnemonic = import.meta.env.VITE_TEST_FREELANCER_MNEMONIC;

    if (clientMnemonic) {
      const acc = algosdk.mnemonicToSecretKey(clientMnemonic);
      this.clientWallet = {
        address: typeof acc.addr === 'string' ? acc.addr : acc.addr.toString(),
        mnemonic: clientMnemonic,
        sk: acc.sk,
        balance: 0,
        asaBalance: 0
      };
    } else {
      // Mock generated if not configured
      const acc = algosdk.generateAccount();
      this.clientWallet = {
        address: typeof acc.addr === 'string' ? acc.addr : acc.addr.toString(),
        sk: acc.sk,
        mnemonic: algosdk.secretKeyToMnemonic(acc.sk),
        balance: 0,
        asaBalance: 0
      };
    }

    if (freelancerMnemonic) {
      const acc = algosdk.mnemonicToSecretKey(freelancerMnemonic);
      this.freelancerWallet = {
        address: typeof acc.addr === 'string' ? acc.addr : acc.addr.toString(),
        mnemonic: freelancerMnemonic,
        sk: acc.sk,
        balance: 0,
        asaBalance: 0
      };
    } else {
      // Mock generated if not configured
      const acc = algosdk.generateAccount();
      this.freelancerWallet = {
        address: typeof acc.addr === 'string' ? acc.addr : acc.addr.toString(),
        sk: acc.sk,
        mnemonic: algosdk.secretKeyToMnemonic(acc.sk),
        balance: 0,
        asaBalance: 0
      };
    }

    // Proactively query balances
    this.updateBalances().catch(() => {});
  }

  async updateBalances() {
    try {
      const clientInfo = await this.algodClient.accountInformation(this.clientWallet.address).do();
      this.clientWallet.balance = Number(clientInfo.amount) / 1000000;
      const clientAssets = clientInfo.assets || [];
      const clientAsa = clientAssets.find(a => Number(a['asset-id']) === this.assetId);
      this.clientWallet.asaBalance = clientAsa ? Number(clientAsa.amount) / 1000000 : 0;

      const freelancerInfo = await this.algodClient.accountInformation(this.freelancerWallet.address).do();
      this.freelancerWallet.balance = Number(freelancerInfo.amount) / 1000000;
      const freelancerAssets = freelancerInfo.assets || [];
      const freelancerAsa = freelancerAssets.find(a => Number(a['asset-id']) === this.assetId);
      this.freelancerWallet.asaBalance = freelancerAsa ? Number(freelancerAsa.amount) / 1000000 : 0;
    } catch (e) {
      console.warn('Failed to update wallet balances from node:', e);
    }
  }

  getClientWallet() {
    this.updateBalances().catch(() => {});
    return { ...this.clientWallet };
  }

  getFreelancerWallet() {
    this.updateBalances().catch(() => {});
    return { ...this.freelancerWallet };
  }

  async compileTeal(tealSource) {
    const compiled = await this.algodClient.compile(tealSource).do();
    return base64ToUint8Array(compiled.result);
  }

  async createEscrowApp(clientMnemonic, totalAmount) {
    console.log(`[REAL ESCROW] Creating Smart Contract Escrow for amount: ${totalAmount}...`);
    const clientAccount = algosdk.mnemonicToSecretKey(clientMnemonic);
    const freelancerAddressBytes = algosdk.decodeAddress(this.freelancerWallet.address).publicKey;
    
    if (!this.assetId || isNaN(this.assetId) || this.assetId <= 0) {
      throw new Error(`Invalid asset ID configured: ${this.assetId}`);
    }
    const assetIdBytes = algosdk.encodeUint64(this.assetId);

    const approvalBytes = await this.compileTeal(approvalTeal);
    const clearBytes = await this.compileTeal(clearTeal);

    const params = await this.algodClient.getTransactionParams().do();
    
    // Create Application transaction
    const appCreateTx = algosdk.makeApplicationCreateTxnFromObject({
      sender: clientAccount.addr,
      suggestedParams: params,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
      approvalProgram: approvalBytes,
      clearProgram: clearBytes,
      numLocalInts: 0,
      numLocalByteSlices: 0,
      numGlobalInts: 2, // asset_id, disputed
      numGlobalByteSlices: 2, // client, freelancer
      appArgs: [
        freelancerAddressBytes,
        assetIdBytes
      ]
    });

    const signedAppCreate = appCreateTx.signTxn(clientAccount.sk);
    const appCreateTxId = appCreateTx.txID();
    await this.algodClient.sendRawTransaction(signedAppCreate).do();
    console.log(`[REAL ESCROW] App creation transaction submitted. TxID: ${appCreateTxId}`);
    
    const confirmation = await algosdk.waitForConfirmation(this.algodClient, appCreateTxId, 4);
    // algosdk v3 uses camelCase keys and BigInt values
    const appId = Number(confirmation['applicationIndex'] || confirmation['application-index']);
    if (!appId || isNaN(appId)) {
      throw new Error('Failed to retrieve application ID from deployment confirmation.');
    }
    console.log(`[REAL ESCROW] Escrow App deployed successfully. App ID: ${appId}`);

    const escrowAddress = algosdk.getApplicationAddress(appId);
    console.log(`[REAL ESCROW] Computed Escrow Address: ${escrowAddress}`);

    // Fund the App Escrow address with 0.5 ALGO to cover MBR and inner transaction fees
    console.log(`[REAL ESCROW] Funding Escrow contract account with 0.5 ALGO...`);
    const fundParams = await this.algodClient.getTransactionParams().do();
    const fundTx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: clientAccount.addr,
      receiver: escrowAddress,
      amount: 500000, // 0.5 ALGO
      suggestedParams: fundParams
    });

    const signedFund = fundTx.signTxn(clientAccount.sk);
    const fundTxId = fundTx.txID();
    await this.algodClient.sendRawTransaction(signedFund).do();
    await algosdk.waitForConfirmation(this.algodClient, fundTxId, 4);
    console.log(`[REAL ESCROW] Funded Escrow account with 0.5 ALGO. TxID: ${fundTxId}`);

    await this.updateBalances();
    return { appId, txId: appCreateTxId };
  }

  async fundEscrow(clientMnemonic, appId, amount) {
    console.log(`[REAL ESCROW] Funding Escrow App ${appId} with ${amount} USDC...`);
    const clientAccount = algosdk.mnemonicToSecretKey(clientMnemonic);
    const escrowAddress = algosdk.getApplicationAddress(appId);

    // 1. Submit NoOp call to opt-in the contract to the asset
    console.log(`[REAL ESCROW] Triggering app opt_in to Asset ${this.assetId}...`);
    const optInParams = await this.algodClient.getTransactionParams().do();
    const optInTx = algosdk.makeApplicationNoOpTxnFromObject({
      sender: clientAccount.addr,
      appIndex: appId,
      suggestedParams: optInParams,
      appArgs: [new TextEncoder().encode('opt_in')],
      foreignAssets: [this.assetId]
    });

    const signedOptIn = optInTx.signTxn(clientAccount.sk);
    const optInTxId = optInTx.txID();
    await this.algodClient.sendRawTransaction(signedOptIn).do();
    await algosdk.waitForConfirmation(this.algodClient, optInTxId, 4);
    console.log(`[REAL ESCROW] Escrow contract successfully opted in to asset. TxID: ${optInTxId}`);

    // 2. Transfer USDC from Client to Escrow Address
    if (!this.assetId || isNaN(this.assetId) || this.assetId <= 0) {
      throw new Error(`Invalid asset ID configured: ${this.assetId}`);
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error(`Invalid funding amount: ${amount}`);
    }
    const rawAmount = Math.round(parsedAmount * 1000000);
    console.log(`[REAL ESCROW] Transferring raw ${rawAmount} units to Escrow Address ${escrowAddress}...`);
    const transferParams = await this.algodClient.getTransactionParams().do();
    const transferTx = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: clientAccount.addr,
      receiver: escrowAddress,
      assetIndex: this.assetId,
      amount: rawAmount,
      suggestedParams: transferParams
    });

    const signedTransfer = transferTx.signTxn(clientAccount.sk);
    const transferTxId = transferTx.txID();
    await this.algodClient.sendRawTransaction(signedTransfer).do();
    await algosdk.waitForConfirmation(this.algodClient, transferTxId, 4);
    console.log(`[REAL ESCROW] Escrow successfully funded with USDC. TxID: ${transferTxId}`);

    await this.updateBalances();
    return { txId: transferTxId, amount: Number(amount) };
  }

  async releaseMilestone(clientMnemonic, appId, freelancerAddress, amount) {
    console.log(`[REAL ESCROW] Releasing milestone: ${amount} USDC to ${freelancerAddress}...`);
    const clientAccount = algosdk.mnemonicToSecretKey(clientMnemonic);
    const rawAmount = Math.round(Number(amount) * 1000000);

    // Make sure freelancer is opted-in to the asset
    await this.ensureReceiverOptIn(this.freelancerWallet);

    const params = await this.algodClient.getTransactionParams().do();
    const releaseTx = algosdk.makeApplicationNoOpTxnFromObject({
      sender: clientAccount.addr,
      appIndex: appId,
      suggestedParams: params,
      appArgs: [
        new TextEncoder().encode('release'),
        algosdk.encodeUint64(rawAmount)
      ],
      foreignAssets: [this.assetId],
      accounts: [typeof freelancerAddress === 'string' ? freelancerAddress : freelancerAddress.toString()]
    });

    const signedRelease = releaseTx.signTxn(clientAccount.sk);
    const releaseTxId = releaseTx.txID();
    await this.algodClient.sendRawTransaction(signedRelease).do();
    await algosdk.waitForConfirmation(this.algodClient, releaseTxId, 4);
    console.log(`[REAL ESCROW] Milestone released successfully on-chain! TxID: ${releaseTxId}`);

    await this.updateBalances();
    return { txId: releaseTxId, amount: Number(amount) };
  }

  async releaseEscrow(clientMnemonic, appId, freelancerAddress) {
    const escrowAddress = algosdk.getApplicationAddress(appId);
    const accountInfo = await this.algodClient.accountInformation(escrowAddress).do();
    const assets = accountInfo.assets || [];
    const matchingAsset = assets.find(a => Number(a['asset-id']) === this.assetId);
    const remainingUSDC = matchingAsset ? Number(matchingAsset.amount) : 0;

    console.log(`[REAL ESCROW] Releasing full remaining balance (${remainingUSDC / 1000000} USDC) to ${freelancerAddress}...`);
    const clientAccount = algosdk.mnemonicToSecretKey(clientMnemonic);

    await this.ensureReceiverOptIn(this.freelancerWallet);

    const params = await this.algodClient.getTransactionParams().do();
    const releaseTx = algosdk.makeApplicationNoOpTxnFromObject({
      sender: clientAccount.addr,
      appIndex: appId,
      suggestedParams: params,
      appArgs: [
        new TextEncoder().encode('release'),
        algosdk.encodeUint64(remainingUSDC)
      ],
      foreignAssets: [this.assetId],
      accounts: [typeof freelancerAddress === 'string' ? freelancerAddress : freelancerAddress.toString()]
    });

    const signedRelease = releaseTx.signTxn(clientAccount.sk);
    const releaseTxId = releaseTx.txID();
    await this.algodClient.sendRawTransaction(signedRelease).do();
    await algosdk.waitForConfirmation(this.algodClient, releaseTxId, 4);
    console.log(`[REAL ESCROW] Full escrow released successfully! TxID: ${releaseTxId}`);

    await this.updateBalances();
    return { txId: releaseTxId };
  }

  async refundEscrow(clientMnemonic, appId) {
    const escrowAddress = algosdk.getApplicationAddress(appId);
    const accountInfo = await this.algodClient.accountInformation(escrowAddress).do();
    const assets = accountInfo.assets || [];
    const matchingAsset = assets.find(a => Number(a['asset-id']) === this.assetId);
    const remainingUSDC = matchingAsset ? Number(matchingAsset.amount) : 0;

    console.log(`[REAL ESCROW] Refunding remaining balance (${remainingUSDC / 1000000} USDC) to client...`);
    const clientAccount = algosdk.mnemonicToSecretKey(clientMnemonic);

    const params = await this.algodClient.getTransactionParams().do();
    const refundTx = algosdk.makeApplicationNoOpTxnFromObject({
      sender: clientAccount.addr,
      appIndex: appId,
      suggestedParams: params,
      appArgs: [
        new TextEncoder().encode('refund'),
        algosdk.encodeUint64(remainingUSDC)
      ],
      foreignAssets: [this.assetId]
    });

    const signedRefund = refundTx.signTxn(clientAccount.sk);
    const refundTxId = refundTx.txID();
    await this.algodClient.sendRawTransaction(signedRefund).do();
    await algosdk.waitForConfirmation(this.algodClient, refundTxId, 4);
    console.log(`[REAL ESCROW] Escrow refunded successfully! TxID: ${refundTxId}`);

    await this.updateBalances();
    return { txId: refundTxId };
  }

  async raiseDispute(appId) {
    console.log(`[REAL ESCROW] Raising dispute on Escrow App ${appId}...`);
    const clientMnemonic = import.meta.env.VITE_TEST_CLIENT_MNEMONIC;
    if (!clientMnemonic) {
      throw new Error('Client mnemonic is not configured in env.');
    }
    const clientAccount = algosdk.mnemonicToSecretKey(clientMnemonic);

    const params = await this.algodClient.getTransactionParams().do();
    const disputeTx = algosdk.makeApplicationNoOpTxnFromObject({
      sender: clientAccount.addr,
      appIndex: appId,
      suggestedParams: params,
      appArgs: [new TextEncoder().encode('dispute')],
      foreignAssets: [this.assetId]
    });

    const signedDispute = disputeTx.signTxn(clientAccount.sk);
    const disputeTxId = disputeTx.txID();
    await this.algodClient.sendRawTransaction(signedDispute).do();
    await algosdk.waitForConfirmation(this.algodClient, disputeTxId, 4);
    console.log(`[REAL ESCROW] Dispute filed on-chain. TxID: ${disputeTxId}`);

    return { txId: disputeTxId };
  }

  async ensureReceiverOptIn(wallet) {
    try {
      const info = await this.algodClient.accountInformation(wallet.address).do();
      const assets = info.assets || [];
      const isOptedIn = assets.some(a => Number(a['asset-id']) === this.assetId);
      
      if (!isOptedIn) {
        console.log(`[REAL ESCROW] Opting ${wallet.address} in to ASA ${this.assetId}...`);
        
        // Fund wallet with 0.3 ALGO from client if balance is below 0.3
        const balance = Number(info.amount) / 1000000;
        if (balance < 0.3) {
          console.log(`[REAL ESCROW] Funding ${wallet.address} with 0.3 ALGO to cover MBR...`);
          const clientAcc = algosdk.mnemonicToSecretKey(this.clientWallet.mnemonic);
          const fundParams = await this.algodClient.getTransactionParams().do();
          const fundTx = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: clientAcc.addr,
            receiver: wallet.address,
            amount: 300000,
            suggestedParams: fundParams
          });
          const signedFund = fundTx.signTxn(clientAcc.sk);
          await this.algodClient.sendRawTransaction(signedFund).do();
          await algosdk.waitForConfirmation(this.algodClient, fundTx.txID(), 4);
        }

        const optParams = await this.algodClient.getTransactionParams().do();
        const optTx = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender: wallet.address,
          receiver: wallet.address,
          assetIndex: this.assetId,
          amount: 0,
          suggestedParams: optParams
        });
        const signedOpt = optTx.signTxn(wallet.sk);
        await this.algodClient.sendRawTransaction(signedOpt).do();
        await algosdk.waitForConfirmation(this.algodClient, optTx.txID(), 4);
        console.log(`[REAL ESCROW] ${wallet.address} successfully opted in to asset.`);
      }
    } catch (e) {
      console.warn('Failed to ensure opt-in for receiver:', e);
    }
  }

  getEscrowApp(appId) {
    // Standard mock tracker state fallback to verify app properties
    return {
      appId,
      totalAmount: 0,
      funded: true,
      fundedAmount: 0,
      status: 'FUNDED',
      createdAt: new Date().toISOString()
    };
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const AlgorandService = new AlgorandServiceClass();
