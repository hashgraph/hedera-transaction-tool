import * as path from 'path';

export default (): string | string[] => {
  const env = process.env.NODE_ENV || 'development';

  const envFileName = env === 'test' ? '.env.test' : '.env';
  const serviceEnvPath = path.resolve(__dirname, `../../${envFileName}`);

  return serviceEnvPath;
};
