export function motorBatteryParser(value) {
    if (typeof value !== "string") {
        return { voltage: null, status: null };
    }

    const regex = /V:\s*([\d.]+)\s*V\s*\|\s*Status:\s*(\d+)%/i;
    const match = value.match(regex);

    if (!match) {
        return { voltage: null, status: null };
    }

    return {
        voltage: parseFloat(match[1]), // 0.70
        status: parseInt(match[2], 10)  // 0
    };
}