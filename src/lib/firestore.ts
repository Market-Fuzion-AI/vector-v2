import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";

export const getCollectionCount = async (collectionName: string): Promise<number> => {
  const colRef = collection(db, collectionName);
  const snapshot = await getDocs(colRef);
  return snapshot.size;
};
