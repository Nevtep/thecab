type StoredValue = string | null;

const memoryStore = new Map<string, string>();

async function getItem(key: string): Promise<StoredValue> {
  return memoryStore.get(key) ?? null;
}

async function setItem(key: string, value: string): Promise<void> {
  memoryStore.set(key, value);
}

async function removeItem(key: string): Promise<void> {
  memoryStore.delete(key);
}

async function clear(): Promise<void> {
  memoryStore.clear();
}

const asyncStorage = {
  getItem,
  setItem,
  removeItem,
  clear
};

export { clear, getItem, removeItem, setItem };
export default asyncStorage;