export function findValueInMap(map: Map<unknown, unknown>, value: unknown): unknown | undefined {
    return [...map.entries()].find((entry) => entry[1] == value)?.[0];
}
