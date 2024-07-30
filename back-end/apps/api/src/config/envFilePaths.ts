import * as path from 'path';

export default (): string | string[] => {
  const env = process.env.NODE_ENV || 'development';

  const paths: string[] = [];

  const envFileName = env === 'test' ? '.env.test' : '.env';
  const serviceEnvPath = path.resolve(__dirname, `../../${envFileName}`);

  paths.push(serviceEnvPath);

  /* 
    The application is run in docker
  */
  if (process.env.NODE_ENV !== 'test') {
    const rootEnvPath = path.resolve(__dirname, '../../../../.env');
    paths.push(rootEnvPath);
  }

  console.log(paths);

  return paths;
};
