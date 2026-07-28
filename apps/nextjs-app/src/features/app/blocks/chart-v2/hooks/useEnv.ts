import { useContext } from 'react';
import { EnvContext } from './EnvProvider';

export const useEnv = () => {
  return useContext(EnvContext);
};
