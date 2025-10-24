function signatureMapToV1Json(signatureMap) {
  const result = {};
  for (const nodeAccountId of signatureMap.keys()) {
    result[nodeAccountId] = {};
    const txMap = signatureMap.get(nodeAccountId);
    for (const transactionId of txMap.keys()) {
      const pkMap = txMap.get(transactionId);
      for (const publicKey of pkMap.keys()) {
        const signature = pkMap.get(publicKey);
        // Convert signature to base64
        result[nodeAccountId][publicKey] = Buffer.from(signature).toString('base64');
      }
    }
  }
  return JSON.stringify(result);
}

module.exports = { signatureMapToV1Json };
