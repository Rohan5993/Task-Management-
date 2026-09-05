import { auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  // Gracefully handle aborted/cancelled requests which are common during component unmounting
  // or navigation in a rapid development environment.
  const errorMsg = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : (error as any)?.name;
  const errorCode = (error as any)?.code;

  const isAbort = 
    errorName === 'AbortError' || 
    errorCode === 'cancelled' ||
    errorMsg.toLowerCase().includes('aborted') ||
    errorMsg.toLowerCase().includes('cancelled') ||
    errorMsg.toLowerCase().includes('cancel') ||
    errorMsg.toLowerCase().includes('signal is aborted') ||
    errorMsg.toLowerCase().includes('aborted a request');
  
  if (isAbort) {
    console.warn(`Firestore Operation Silently Stopped: ${operationType} on ${path}`, error);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
