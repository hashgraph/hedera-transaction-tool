import * as path from 'path';
import { filterForImportV1 } from '@main/services/localUser/importV1';
import * as unzipper from 'unzipper';
import { extractUnzipperFileToBuffer } from '@main/utils/files';

describe('V1 import utilities', () => {
  test('filterForImportV1', async () => {
    const dataFolder = path.resolve(__dirname, 'importV1');
    const filePaths = [
      path.resolve(dataFolder, '1759854344_0.0.1584_2123674909_ed-testnet.zip'),
      path.resolve(dataFolder, '1759854344_0.0.1584_2123674909_ed-testnet-missing-tx.zip'),
      path.resolve(dataFolder, '1759854344_0.0.1584_2123674909_ed-testnet-missing-json.zip'),
      path.resolve(dataFolder, 'hello-world.zip'),
      path.resolve(dataFolder, 'invalid-zip.zip'),
    ];

    const results = await filterForImportV1(filePaths);
    expect(results.candidates.length).toBe(1);
    expect(results.ignoredPaths.length).toBe(4);
    expect(results.ignoredPaths).toStrictEqual([
      filePaths[1],
      filePaths[2],
      filePaths[3],
      filePaths[4],
    ]);

    const c0 = results.candidates[0];
    expect(c0.transactionId).toBe('0.0.1584@1759854344.000000000');
    expect(c0.transactionBytes).toStrictEqual(
      '0ad6012ad3010a680a150a080888fe94c706100012070800100018b00c18001206080010001809188084af5f220308b4013200723b0a390a110a070800100018930a10ff9bc99b0518000a110a0708001000189d0b10ff9bc99b0518000a110a070800100018b00c1080b892b70a180012670a650a2103d236ba45caea9dd8053b6b0db1953564a4d06c9fb7dbf93bec499e6362b5b45f32406275ba7ab4232424df883267d5c3fe29857193e8e00fc858af14359c8123367601634fcf191fa07b00da266db0d3716e2b642fe6bfea0f49e8e3da5d432888510ad6012ad3010a680a150a080888fe94c706100012070800100018b00c18001206080010001804188084af5f220308b4013200723b0a390a110a070800100018930a10ff9bc99b0518000a110a0708001000189d0b10ff9bc99b0518000a110a070800100018b00c1080b892b70a180012670a650a2103d236ba45caea9dd8053b6b0db1953564a4d06c9fb7dbf93bec499e6362b5b45f32406541a88705b1249e4fdfdfa63cff0d90d8d0e11ccea4fa39a67abe9efe4edc85236423e4405184647bd560dd45500acfa658b41cf998c307b2644ee93c366a300ad6012ad3010a680a150a080888fe94c706100012070800100018b00c18001206080010001807188084af5f220308b4013200723b0a390a110a070800100018930a10ff9bc99b0518000a110a0708001000189d0b10ff9bc99b0518000a110a070800100018b00c1080b892b70a180012670a650a2103d236ba45caea9dd8053b6b0db1953564a4d06c9fb7dbf93bec499e6362b5b45f324031361d067ff5b3cbc7a1c1ec9a399764bbc057058ec78b5da07a55a054ff848b0601efc8f1a0afedc6578f8e894a7658b171cd4001832472d820dda0086ff3f00ad6012ad3010a680a150a080888fe94c706100012070800100018b00c18001206080010001803188084af5f220308b4013200723b0a390a110a070800100018930a10ff9bc99b0518000a110a0708001000189d0b10ff9bc99b0518000a110a070800100018b00c1080b892b70a180012670a650a2103d236ba45caea9dd8053b6b0db1953564a4d06c9fb7dbf93bec499e6362b5b45f3240586bf169e4d769c99fb993e15fde7fac7206115f5107ac5aed47286a174d6e0d40ab3278bf9a016cd94a4fc54b51461b8e2393cbacf79b023fa2cbd409d3d98e0ad6012ad3010a680a150a080888fe94c706100012070800100018b00c18001206080010001806188084af5f220308b4013200723b0a390a110a070800100018930a10ff9bc99b0518000a110a0708001000189d0b10ff9bc99b0518000a110a070800100018b00c1080b892b70a180012670a650a2103d236ba45caea9dd8053b6b0db1953564a4d06c9fb7dbf93bec499e6362b5b45f3240493085339ee957eaa13ce7ca5de33bb2301df02c55686a31fe72db8232a4ce5241311f601fe1d52752397a8bbb367560dbb9bbf11ce031b0e93ef7ec08999408',
    );
    expect(c0.nodeSignatures).toStrictEqual({
      '0.0.3': {
        '302a300506032b657003210009f87c3d02ba294c408cdace12829fad51d3f2358f0e57e51f6814bea98fb21c':
          'AFU5KMeJQ3v2qpIMeyB+hjonD88lJyqbfdeBt3Q9YMwFnDN3otTIc1NzDXDMRyfqn60Fr0FUFOWylr4AuY/UDQ==',
      },
      '0.0.4': {
        '302a300506032b657003210009f87c3d02ba294c408cdace12829fad51d3f2358f0e57e51f6814bea98fb21c':
          'tCgf9bwGN1Q2ck5EVPBP+LGqICsjYfiba5bwOo3r6v+eckYVWB9Tf/KIaM5U7cqBXELi9DEqwL4GuO3tLtLEBA==',
      },
      '0.0.7': {
        '302a300506032b657003210009f87c3d02ba294c408cdace12829fad51d3f2358f0e57e51f6814bea98fb21c':
          'OfCFABUX/mIdEzB1JOc3nD54THrP8W0MFSX0Vno+GDBhXjhOCNeW6YrI8DvDp2Y4vJDqYWUlIxGJrPxLpUwkCA==',
      },
      '0.0.6': {
        '302a300506032b657003210009f87c3d02ba294c408cdace12829fad51d3f2358f0e57e51f6814bea98fb21c':
          'RQQmiK8ovLDysxKzx6hdx3qMDWJbs1FtpEZZf76yew1FKPe6ci8jpPGr8mtvyUlCLwda2aT5NYzoqZbSWVT8Dg==',
      },
      '0.0.9': {
        '302a300506032b657003210009f87c3d02ba294c408cdace12829fad51d3f2358f0e57e51f6814bea98fb21c':
          'BqnF6Hl6ANAb/0/3DEyWhFaAlIfRFFwJ5YiC0rJRvDV98xIiJ/eWsIjwn1IE3wHF4+JFJgzIhsc0fKgv8YAABA==',
      },
    });
  });

  test('extractUnzipperFileToBuffer', async () => {
    const dataFolder = path.resolve(__dirname, 'importV1');
    const filePath = path.resolve(dataFolder, '1759854344_0.0.1584_2123674909_ed-testnet.zip');

    const zipDirectory = await unzipper.Open.file(filePath);
    const txFile = zipDirectory.files.find(f => path.extname(f.path) === '.tx');
    expect(txFile).toBeDefined();

    const abortSignal = { aborted: true } as AbortSignal;
    try {
      await extractUnzipperFileToBuffer(txFile!, abortSignal);
      expect(false);
    } catch (error) {
      expect(error).toBe('File extraction aborted');
    }
    const f = async () => await extractUnzipperFileToBuffer(txFile!, abortSignal);
    expect(f).rejects.toThrow('File extraction aborted');
  });
});
