import WebSocket from 'ws';
import { PriceFeedResponse, PriceFeedResponseSchema } from '../types';
import { API_ENDPOINTS } from '../config';

/**
 * Callback function type for price updates
 */
export type PriceUpdateCallback = (priceData: PriceFeedResponse) => void;

/**
 * WebSocket client for real-time price feeds from Pyth Network
 */
export class FeedClient {
  private url: string;
  private ws?: WebSocket;
  private callbacks: Map<string, PriceUpdateCallback[]>;
  private onError?: (error: Error) => void;
  private onClose?: () => void;
  private pairFeedMap: Map<string, string>;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  /**
   * Create a FeedClient instance
   * @param url - WebSocket URL (default: Pyth Hermes)
   * @param onError - Error callback
   * @param onClose - Close callback
   */
  constructor(
    url: string = API_ENDPOINTS.PYTH_WS,
    onError?: (error: Error) => void,
    onClose?: () => void
  ) {
    this.url = url;
    this.callbacks = new Map();
    this.onError = onError;
    this.onClose = onClose;
    this.pairFeedMap = new Map();
  }

  /**
   * Register a callback for a specific price feed
   * @param feedId - Pyth price feed ID
   * @param callback - Callback function to handle price updates
   */
  registerPriceFeedCallback(feedId: string, callback: PriceUpdateCallback): void {
    if (!this.callbacks.has(feedId)) {
      this.callbacks.set(feedId, []);
    }
    this.callbacks.get(feedId)!.push(callback);
  }

  /**
   * Unregister a callback for a specific price feed
   * @param feedId - Pyth price feed ID
   * @param callback - Callback function to remove
   */
  unregisterPriceFeedCallback(feedId: string, callback: PriceUpdateCallback): void {
    const feedCallbacks = this.callbacks.get(feedId);
    if (feedCallbacks) {
      const index = feedCallbacks.indexOf(callback);
      if (index > -1) {
        feedCallbacks.splice(index, 1);
      }
    }
  }

  /**
   * Load pair to feed ID mappings
   * This should be called with actual mappings from the Avantis API
   * @param pairFeeds - Map of pair names to Pyth feed IDs
   */
  loadPairFeeds(pairFeeds: Map<string, string>): void {
    this.pairFeedMap = pairFeeds;
  }

  /**
   * Get feed ID for a trading pair
   * @param pairName - Trading pair name (e.g., "BTC/USD")
   * @returns Feed ID or undefined
   */
  getFeedIdForPair(pairName: string): string | undefined {
    return this.pairFeedMap.get(pairName);
  }

  /**
   * Connect to WebSocket and listen for price updates
   * @returns Promise that resolves when connection is established
   */
  async listenForPriceUpdates(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          console.log('WebSocket connected to Pyth Network');
          this.reconnectAttempts = 0;

          // Subscribe to all registered feeds
          const feedIds = Array.from(this.callbacks.keys());
          if (feedIds.length > 0) {
            this.subscribeToPriceFeeds(feedIds);
          }

          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());

            // Handle price update messages
            if (message.type === 'price_update') {
              this.handlePriceUpdate(message);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        });

        this.ws.on('error', (error: Error) => {
          console.error('WebSocket error:', error);
          if (this.onError) {
            this.onError(error);
          }
          reject(error);
        });

        this.ws.on('close', () => {
          console.log('WebSocket connection closed');
          if (this.onClose) {
            this.onClose();
          }

          // Attempt to reconnect
          this.attemptReconnect();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Subscribe to specific price feeds
   * @param feedIds - Array of feed IDs to subscribe to
   */
  private subscribeToPriceFeeds(feedIds: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot subscribe');
      return;
    }

    const subscribeMessage = {
      type: 'subscribe',
      ids: feedIds,
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    console.log(`Subscribed to ${feedIds.length} price feeds`);
  }

  /**
   * Unsubscribe from specific price feeds
   * @param feedIds - Array of feed IDs to unsubscribe from
   */
  private unsubscribeFromPriceFeeds(feedIds: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const unsubscribeMessage = {
      type: 'unsubscribe',
      ids: feedIds,
    };

    this.ws.send(JSON.stringify(unsubscribeMessage));
  }

  /**
   * Handle incoming price update
   * @param message - Price update message
   */
  private handlePriceUpdate(message: any): void {
    try {
      // Validate and parse the price feed response
      const priceFeed = PriceFeedResponseSchema.parse(message);

      // Trigger callbacks for this feed
      const callbacks = this.callbacks.get(priceFeed.id);
      if (callbacks) {
        callbacks.forEach((callback) => {
          try {
            callback(priceFeed);
          } catch (error) {
            console.error('Error in price update callback:', error);
          }
        });
      }
    } catch (error) {
      console.error('Error processing price update:', error);
    }
  }

  /**
   * Attempt to reconnect to WebSocket
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.listenForPriceUpdates().catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Get latest prices via HTTP (synchronous alternative to WebSocket)
   * @param feedIds - Array of feed IDs
   * @returns Promise with price data
   */
  async getLatestPriceUpdates(feedIds: string[]): Promise<any> {
    const url = `${API_ENDPOINTS.PYTH_HTTP}?ids[]=${feedIds.join('&ids[]=')}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch prices: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Close the WebSocket connection
   */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== undefined && this.ws.readyState === WebSocket.OPEN;
  }
}
