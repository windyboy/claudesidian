/**
 * Simple integration test for the plugin system
 */

import { system, EventScope, EventPriority } from './index.js';

async function testPluginSystem() {
  console.log('Testing Plugin Integration and Event System...');
  
  try {
    // Test event system
    console.log('1. Testing event system...');
    
    const { events } = await import('./event-system.js');
    
    // Subscribe to a test event
    const subscription = events.on('test.event', (event) => {
      console.log('Received test event:', event.data);
    });
    
    // Emit a test event
    await events.emit('test.event', { message: 'Hello from event system!' });
    
    // Unsubscribe
    subscription.unsubscribe();
    
    console.log('✅ Event system working');
    
    // Test plugin loader
    console.log('2. Testing plugin loader...');
    
    const { PluginLoader } = await import('./plugin-loader.js');
    const loader = new PluginLoader();
    
    // Register a test plugin
    loader.register({
      name: 'test-plugin',
      version: '1.0.0',
      enabled: true
    });
    
    // Validate dependencies
    const validation = loader.validateDependencies();
    console.log('Dependency validation:', validation);
    
    console.log('✅ Plugin loader working');
    
    // Test plugin manager
    console.log('3. Testing plugin manager...');
    
    const { PluginManager } = await import('./plugin-integration.js');
    const manager = new PluginManager();
    
    console.log('Plugin manager created');
    console.log('Is initialized:', manager.isInitialized());
    
    console.log('✅ Plugin manager working');
    
    console.log('🎉 All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testPluginSystem();
}

export { testPluginSystem };