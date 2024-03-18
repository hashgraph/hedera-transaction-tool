import { TransactionBaseModel } from './transaction.model';
import { TransferTransaction } from '@hashgraph/sdk';

export default class TransferTransactionModel extends TransactionBaseModel {
  getSigningAccountsOrKeys(): Set<string> {
    // Get the Fee Payer
    const accounts = super.getSigningAccountsOrKeys();

    // Go through all the transfers and add the accounts to the array.
    // All accounts are included, whether it is a receiving account that
    // requires a signature or not. This is because the 'signature required'
    // flag can change at any time, and this list of accounts could then be wrong
    // if stored (as it is in the transaction datatable). So all accounts are
    // included.
    //TODO if all accounts are included, how do we differentiate between those
    // that need to be sign and not? Meaning if I am on account 44, and account 44
    // is NOT flagged to require sig for receiving, when I pull transactions for account 44
    // I will pull any transaction that 44 is the receiver, and it will be displayed on the client
    // indicating I need to sign it. That is not right. So, then what? When the user signs in
    // they will pull accountIds for their keys? or do they pull full account info? if account info, easy
    // if not, I'd have to do another check?
    // Also, if I am logged in already, then someone flips the flag, how would I get notified of the
    // transactions I now need to sign? In order to flip the flag, an account update needs to go through.
    // And if that is done outside of this app, ugh. But it really shouldn't be able to be done outside of a
    // multi sig solution. So let's say it has to be done inside the app. But let's also say that I didn't sign
    // the account update, but it passed due to other sigs. Someone somewhere would then need to pull/push the
    // new transactions. If the server pushes, it would need to go through each transaction for the updated account
    // and find all keys on that transaction for that account and push the transaction. Or could it just
    // get the users for the keys on the updated account and notify the user to pull new data?
    const transaction = this.transaction as TransferTransaction;
    for (const [key, value] of transaction.hbarTransfers) {
      accounts.add(key.toString());
    }
    return accounts;
  }
}
