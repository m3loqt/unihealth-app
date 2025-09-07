import { supabase } from '@/config/supabase';

export async function testSupabaseConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('Testing Supabase connection...');
    
    // Test 1: List buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      return { success: false, error: `Bucket list failed: ${bucketsError.message}` };
    }
    
    console.log('✅ Supabase buckets:', buckets?.map(b => b.name));
    
    // Test 2: Check if voice-messages bucket exists
    const voiceMessagesBucket = buckets?.find(b => b.name === 'voice-messages');
    if (!voiceMessagesBucket) {
      return { success: false, error: 'voice-messages bucket not found' };
    }
    
    console.log('✅ voice-messages bucket found');
    
    // Test 3: Try to list files in the bucket (this tests permissions)
    const { data: files, error: filesError } = await supabase.storage
      .from('voice-messages')
      .list('', { limit: 1 });
    
    if (filesError) {
      return { success: false, error: `File list failed: ${filesError.message}` };
    }
    
    console.log('✅ Can access voice-messages bucket');
    
    return { success: true };
  } catch (error) {
    console.error('Supabase test failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
