
import { ItemCategory } from '../types';

export const classifyItem = (description: string): ItemCategory => {
  const desc = description.toUpperCase();

  if (desc.includes('CABIN FILTER')) return ItemCategory.CABIN_FILTER;
  if (desc.includes('OIL FILTER')) return ItemCategory.OIL_FILTER;
  if (desc.includes('AIR FILTER')) return ItemCategory.AIR_FILTER;
  
  if (desc.includes('BRAKE PAD') || desc.includes('BRAKE PUMP') || desc.includes('BRAKE SHOE') || desc.includes('BRAKE CALIPER') || desc.includes('BRAKE SWITCH') || desc.includes('DISC ROTOR')) {
    return ItemCategory.BRAKES;
  }
  
  if (desc.includes('SPARK PLUG') || desc.includes('PLUG CABLE') || desc.includes('IGNITION COIL') || desc.includes('PLUG SEAL')) {
    return ItemCategory.IGNITION;
  }
  
  if (desc.includes('OIL') || desc.includes('FLUID') || desc.includes('ATF') || desc.includes('CVT') || desc.includes('GEAR OIL')) {
    return ItemCategory.FLUIDS;
  }
  
  if (desc.includes('ABSORBER') || desc.includes('LOWER ARM') || desc.includes('STABILIZER') || desc.includes('BALL JOINT') || desc.includes('RACK END') || desc.includes('TIE ROD')) {
    return ItemCategory.SUSPENSION;
  }
  
  if (desc.includes('BELT') || desc.includes('PK') || desc.includes('BANDO')) {
    return ItemCategory.BELTS;
  }
  
  if (desc.includes('GASKET') || desc.includes('OIL SEAL') || desc.includes('CAM SEAL') || desc.includes('O-RING')) {
    return ItemCategory.GASKETS_SEALS;
  }
  
  if (desc.includes('COOLANT') || desc.includes('RADIATOR') || desc.includes('WATER PUMP') || desc.includes('FAN MOTOR') || desc.includes('THERMOSTAT') || desc.includes('HOSE')) {
    return ItemCategory.COOLING;
  }
  
  if (desc.includes('BATTERY') || desc.includes('NS40') || desc.includes('DIN55')) {
    return ItemCategory.BATTERY;
  }
  
  if (desc.includes('WIPER')) return ItemCategory.WIPERS;
  
  if (desc.includes('RELAY') || desc.includes('BULB') || desc.includes('FUSE') || desc.includes('SWITCH') || desc.includes('SENSOR') || desc.includes('ALTERNATOR') || desc.includes('STARTER')) {
    return ItemCategory.ELECTRICAL;
  }

  return ItemCategory.OTHER;
};
