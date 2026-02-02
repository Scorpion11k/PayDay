export type FlowNodeType = 'start' | 'action' | 'wait' | 'condition' | 'end';
export type ActionType = 'send_email' | 'send_sms' | 'send_whatsapp' | 'voice_ai_call';

export interface FlowNodeData {
  id: string;
  type: FlowNodeType;
  action?: ActionType;
  title: string;
  description?: string;
  duration?: string;
  condition?: string;
}
