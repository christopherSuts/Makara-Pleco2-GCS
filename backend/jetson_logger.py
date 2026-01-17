import time
import psutil
import csv
from datetime import datetime
import os
import sys

# Configuration
INTERVAL_SEC = 0.1
OUTPUT_FILE = "jetson_resources.csv"
INTERFACE = "eth0" 
def get_network_bytes(interface):
    """
    Returns (bytes_sent, bytes_recv) for the specified interface.
    """
    net_io = psutil.net_io_counters(pernic=True)
    if interface in net_io:
        return net_io[interface].bytes_sent, net_io[interface].bytes_recv
    return 0, 0

def main():
    global OUTPUT_FILE
    if len(sys.argv) > 1:
        OUTPUT_FILE = sys.argv[1]
    
    print(f"Starting Jetson Resource Logger. Output: {OUTPUT_FILE}")
    print(f"Monitoring Interface: {INTERFACE} at {1.0/INTERVAL_SEC:.0f}Hz")

    # Initialize CSV if not exists
    file_exists = os.path.isfile(OUTPUT_FILE)
    
    with open(OUTPUT_FILE, mode='a', newline='') as csvfile:
        fieldnames = ['Timestamp', 'CPU_Usage_%', 'RAM_Usage_%', 'TX_Mbps', 'RX_Mbps']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        if not file_exists:
            writer.writeheader()
            print("Created new log file.")

        # Initial reading
        last_tx, last_rx = get_network_bytes(INTERFACE)
        last_time = time.time()
        
        # Determine if we should print warning about interface
        if last_tx == 0 and last_rx == 0:
            print(f"Warning: Interface '{INTERFACE}' not found or no traffic. Available: {list(psutil.net_io_counters(pernic=True).keys())}")

        try:
            while True:
                time.sleep(INTERVAL_SEC)
                
                current_time = time.time()
                current_tx, current_rx = get_network_bytes(INTERFACE)
                
                # Calculate diffs
                dt = current_time - last_time
                tx_diff = current_tx - last_tx
                rx_diff = current_rx - last_rx
                
                # Update last values
                last_time = current_time
                last_tx = current_tx
                last_rx = current_rx
                
                # Convert to Mbps (Bits / 1e6)
                # Ensure dt > 0 to avoid division by zero
                if dt <= 0:
                    continue
                    
                tx_mbps = (tx_diff * 8) / 1_000_000 / dt
                rx_mbps = (rx_diff * 8) / 1_000_000 / dt
                
                # Resource Usage
                cpu_pct = psutil.cpu_percent(interval=None) # Interval None because we sleep manually
                ram_pct = psutil.virtual_memory().percent
                
                timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
                
                row = {
                    'Timestamp': timestamp_str,
                    'CPU_Usage_%': f"{cpu_pct:.1f}",
                    'RAM_Usage_%': f"{ram_pct:.1f}",
                    'TX_Mbps': f"{tx_mbps:.2f}",
                    'RX_Mbps': f"{rx_mbps:.2f}"
                }
                
                writer.writerow(row)
                csvfile.flush() # Ensure it's written immediately
                
                # Optional: Print to console
                print(f"[{timestamp_str}] CPU: {cpu_pct}% | RAM: {ram_pct}% | TX: {tx_mbps:.2f} Mbps | RX: {rx_mbps:.2f} Mbps")
                
        except KeyboardInterrupt:
            print("\nStopping logger.")

if __name__ == "__main__":
    main()
