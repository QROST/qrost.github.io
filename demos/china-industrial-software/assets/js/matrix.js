/**
 * China Industrial Software Survey — Capability Matrix
 */
(function () {
  'use strict';

  const CAPABILITIES = [
    // 几何建模与设计自动化
    { key: 'drafting_2d', zh: '二维工程图', en: '2D Drafting' },
    { key: 'solid_modeling_3d', zh: '三维实体建模', en: '3D Solid Modeling' },
    { key: 'surface_modeling', zh: '高级曲面', en: 'Surfacing' },
    { key: 'assembly_design', zh: '大型装配', en: 'Assembly' },
    { key: 'parametric_design', zh: '参数化驱动', en: 'Parametric Design' },
    { key: 'visual_programming', zh: '视觉编程', en: 'Visual Programming' },
    { key: 'cad_repair_interop', zh: '几何修复与转换', en: 'Geometry Healing & Interop' },
    { key: 'reverse_engineering', zh: '逆向工程/扫描重建', en: 'Reverse Engineering' },
    { key: 'cad_as_code', zh: '程序化/脚本CAD', en: 'Programmatic CAD' },
    { key: 'product_rendering_viz', zh: '渲染与设计评审', en: 'Rendering & Design Review' },
    { key: 'polygon_mesh_dcc', zh: '网格建模与DCC', en: 'Mesh Modeling & DCC' },

    // 物理仿真与工程分析
    { key: 'fea_structure', zh: '结构有限元', en: 'FEA Structure' },
    { key: 'cfd_fluid', zh: '流体动力学', en: 'CFD Fluid' },
    { key: 'electromagnetics', zh: '电磁仿真', en: 'Electromagnetics' },
    { key: 'multi_physics', zh: '多物理场耦合', en: 'Multi-physics' },
    { key: 'material_injection', zh: '材料注塑分析', en: 'Mold Flow & Material' },
    { key: 'code_compliance', zh: '规范验算', en: 'Code Compliance' },
    { key: 'opt_light_acoustics', zh: '光学与声学', en: 'Optics & Acoustics' },
    { key: 'generative_topo_opt', zh: '创成式/拓扑优化', en: 'Generative & Topology Opt' },
    { key: 'multibody_dynamics', zh: '多体动力学', en: 'Multibody Dynamics' },
    { key: 'simulation_vv', zh: '仿真验证与确认(V&V)', en: 'Simulation V&V' },
    { key: 'codegen_hil', zh: '嵌入式代码生成/HIL', en: 'Codegen & HIL' },

    // 半导体 EDA 与 CIM
    { key: 'analog_ic_design', zh: '模拟 IC 设计', en: 'Analog IC Design' },
    { key: 'digital_ic_synthesis', zh: '数字后端与综合', en: 'Digital IC Backend' },
    { key: 'formal_verification', zh: '形式与功能验证', en: 'Verification & Formal' },
    { key: 'physical_prototyping', zh: '原型验证与硬件仿真', en: 'Emulation & Prototyping' },
    { key: 'tcad_device_sim', zh: '器件工艺 TCAD', en: 'TCAD Device Simulation' },
    { key: 'fab_automation_eap', zh: '设备自动化 EAP', en: 'Fab EAP' },
    { key: 'yield_yms', zh: '良率管理 YMS', en: 'Yield YMS' },
    { key: 'pcb_layout_design', zh: 'PCB原理图/布局', en: 'PCB Layout & Routing' },
    { key: 'rtl_simulation', zh: 'RTL/功能仿真', en: 'RTL Simulation' },
    { key: 'ic_physical_signoff', zh: 'IC物理验证与签核', en: 'IC Signoff (DRC/LVS/STA)' },

    // 生命周期与管理
    { key: 'bom_mgmt', zh: 'BOM与配置管理', en: 'BOM & Configuration' },
    { key: 'lifecycle_mgmt', zh: '生命周期管理', en: 'Lifecycle' },
    { key: 'requirements_trace', zh: '需求与合规追溯', en: 'Requirements Traceability' },
    { key: 'mbse_sys', zh: '系统级建模(MBSE)', en: 'MBSE' },
    { key: 'finance_ledger', zh: '财务供应链', en: 'SCM & Finance' },
    { key: 'supply_chain_procurement', zh: '供应链与采购', en: 'Supply Chain & Procurement' },
    { key: 'group_consolidation_mgmt', zh: '集团管控与合并报表', en: 'Group Consolidation' },
    { key: 'change_config_mgmt', zh: '工程更改管理(ECO/ECN)', en: 'Engineering Change Mgmt' },
    { key: 'lims_lab_data', zh: '实验室信息管理(LIMS)', en: 'LIMS' },

    // 制造执行与控制
    { key: 'cam_milling_cnc', zh: '数控加工(CAM)', en: 'CAM & CNC Milling' },
    { key: 'scheduling_ops', zh: '生产排程(APS)', en: 'Scheduling' },
    { key: 'process_control', zh: '过程控制', en: 'Process Control' },
    { key: 'data_acquisition', zh: '工业数据采集', en: 'Data Acquisition' },
    { key: 'quality_spc_traceability', zh: '质量管理与SPC', en: 'Quality & SPC' },
    { key: 'metrology_cmm_inspection', zh: '计量与三坐标检测', en: 'Metrology & CMM' },
    { key: 'enterprise_asset_mgmt', zh: '企业资产管理(EAM)', en: 'EAM' },
    { key: 'predictive_maintenance_apm', zh: '预测性维护(APM)', en: 'Predictive Maintenance' },
    { key: 'iiot_historian', zh: '工业时序Historian', en: 'Industrial Historian' },
    { key: 'ot_protocol_gateway', zh: 'OT协议网关', en: 'OT Protocol Gateway' },
    { key: 'sheet_nesting_2d', zh: '2D套料排样', en: '2D Sheet Nesting' },

    // BIM/GIS 与 3D 打印
    { key: 'bim_clash', zh: 'BIM碰撞检测与协同', en: 'BIM Clash & CDE' },
    { key: 'gis_spatial', zh: 'GIS空间分析', en: 'Spatial GIS' },
    { key: 'slicing_algorithm', zh: '切片算法引擎', en: 'Slicing Engine' },
    { key: 'am_layout', zh: '增材排版与修复', en: 'AM Layout & Healing' },
    { key: 'am_support_gen', zh: '增材支撑生成与编辑', en: 'AM Support Generation' },
    { key: 'bim_quantity_takeoff', zh: 'BIM算量与造价', en: 'BIM Quantity & Cost' },
    { key: 'construction_4d_sim', zh: '4D施工模拟', en: '4D Construction Sim' },
    { key: 'gnss_survey_processing', zh: 'GNSS测绘内业', en: 'GNSS Survey Processing' },

    // 架构与交付
    { key: 'cloud_native', zh: '云原生', en: 'Cloud Native' },
    { key: 'collaboration', zh: '实时协作', en: 'Collaboration' },
    { key: 'ext_api', zh: 'API/插件', en: 'API & Ext' },
    { key: 'xinchuang_compat', zh: '信创适配', en: 'IT Innovation' },
    { key: 'digital_twin', zh: '数字孪生(虚实映射)', en: 'Digital Twin' },
    { key: 'industrial_ar_xr', zh: '工业AR/XR', en: 'Industrial AR/XR' },
  ];

  // Capability domains — column ordering MUST match CAPABILITIES above.
  // Shared with app.js (detail-modal tabs) via window.INDUSTRIAL_MATRIX.CAP_DOMAINS.
  const CAP_DOMAINS = [
    { zh: '几何建模与设计自动化', en: 'Design & Modeling', keys: ['drafting_2d', 'solid_modeling_3d', 'surface_modeling', 'assembly_design', 'parametric_design', 'visual_programming', 'cad_repair_interop', 'reverse_engineering', 'cad_as_code', 'product_rendering_viz', 'polygon_mesh_dcc'] },
    { zh: '物理仿真与工程分析', en: 'Simulation & Analysis', keys: ['fea_structure', 'cfd_fluid', 'electromagnetics', 'multi_physics', 'material_injection', 'code_compliance', 'opt_light_acoustics', 'generative_topo_opt', 'multibody_dynamics', 'simulation_vv', 'codegen_hil'] },
    { zh: '半导体 EDA 与 CIM', en: 'EDA & Semiconductor', keys: ['analog_ic_design', 'digital_ic_synthesis', 'formal_verification', 'physical_prototyping', 'tcad_device_sim', 'fab_automation_eap', 'yield_yms', 'pcb_layout_design', 'rtl_simulation', 'ic_physical_signoff'] },
    { zh: '生命周期与管理', en: 'Lifecycle & Mgmt', keys: ['bom_mgmt', 'lifecycle_mgmt', 'requirements_trace', 'mbse_sys', 'finance_ledger', 'supply_chain_procurement', 'group_consolidation_mgmt', 'change_config_mgmt', 'lims_lab_data'] },
    { zh: '制造执行与控制', en: 'Manufacturing & Control', keys: ['cam_milling_cnc', 'scheduling_ops', 'process_control', 'data_acquisition', 'quality_spc_traceability', 'metrology_cmm_inspection', 'enterprise_asset_mgmt', 'predictive_maintenance_apm', 'iiot_historian', 'ot_protocol_gateway', 'sheet_nesting_2d'] },
    { zh: 'BIM / GIS / 增材', en: 'BIM / GIS / AM', keys: ['bim_clash', 'gis_spatial', 'slicing_algorithm', 'am_layout', 'am_support_gen', 'bim_quantity_takeoff', 'construction_4d_sim', 'gnss_survey_processing'] },
    { zh: '架构与交付', en: 'Architecture & Delivery', keys: ['cloud_native', 'collaboration', 'ext_api', 'xinchuang_compat', 'digital_twin', 'industrial_ar_xr'] },
  ];

  const state = {
    filterOrigin: '',
    filterCategory: '',
    search: '',
    sortKey: '',   // '' | 'name' | 'coverage'
    sortDir: 1,    // 1 asc, -1 desc
  };

  const I18N = () => window.INDUSTRIAL_I18N || {};
  const CAT = () => window.INDUSTRIAL_CATALOG || {};

  function evaluateCapability(p, capKey) {
    // Explicit curated override takes precedence over heuristic inference.
    // Authored per-product in assets/data/categories/*.json as
    //   "capabilities": { "full": ["..."], "partial": ["..."] }
    // When a product is curated (carries a `capabilities` object) the override
    // is AUTHORITATIVE: any capability not listed as full/partial is treated as
    // 'none' — including the case where both lists are empty (curator asserts the
    // product matches none of the 38 keys). The heuristic below applies only to
    // un-curated products, which have no `capabilities` object at all.
    const ov = p.capabilities;
    if (ov && (Array.isArray(ov.full) || Array.isArray(ov.partial))) {
      if (Array.isArray(ov.full) && ov.full.indexOf(capKey) !== -1) return 'full';
      if (Array.isArray(ov.partial) && ov.partial.indexOf(capKey) !== -1) return 'partial';
      return 'none';
    }

    const name = ((p.name_zh || '') + (p.name_en || '') + (p.id || '')).toLowerCase();
    const category = p.category_l2 || '';
    const type = p.product_type || '';
    const tags = p.tags || [];
    const strengths = ((p.strengths_zh || []).concat(p.strengths_en || [])).join(' ').toLowerCase();
    const limitations = ((p.limitations_zh || []).concat(p.limitations_en || [])).join(' ').toLowerCase();

    const hasTerm = (str, term) => str.includes(term.toLowerCase());

    switch (capKey) {
      case 'drafting_2d':
        if (category === 'CAD' && type !== 'mcad') return 'full';
        if (category === 'CAD' || type === 'mcad' || type === '2d_cad') {
          if (hasTerm(limitations, '二维') || hasTerm(limitations, '2d')) return 'partial';
          return 'full';
        }
        if (category === 'BIM' || category === 'GIS') return 'full';
        if (category === '切片软件' || category === 'CAM') return 'partial';
        if (hasTerm(strengths, '二维') || hasTerm(strengths, '2d')) return 'full';
        return 'none';

      case 'solid_modeling_3d':
        if (category === 'CAD' && type !== '2d_cad') return 'full';
        if (category === 'BIM' || category === '切片软件' || type === 'mcad') return 'full';
        if (category === 'CAD' && type === '2d_cad') return 'partial';
        if (category === 'GIS' || category === 'CAM') return 'partial';
        if (hasTerm(strengths, '三维') || hasTerm(strengths, '3d')) return 'full';
        return 'none';

      case 'surface_modeling':
        if (category === 'CAD' && (hasTerm(strengths, '曲面') || hasTerm(strengths, '造型') || hasTerm(name, 'alias') || hasTerm(name, 'rhino') || hasTerm(name, 'surfmill'))) return 'full';
        if (category === 'CAD' && type !== '2d_cad') return 'partial';
        if (category === 'BIM') return 'partial';
        return 'none';

      case 'assembly_design':
        if (category === 'CAD' && (p.maturity === 'high' || p.maturity === 'mission_critical')) return 'full';
        if (category === 'CAD' && type !== '2d_cad') return 'partial';
        if (category === 'BIM') return 'partial';
        return 'none';

      case 'parametric_design':
        if (hasTerm(strengths, '参数化') || hasTerm(strengths, '约束求解') || hasTerm(strengths, 'constraint') || hasTerm(strengths, 'parametric') || hasTerm(name, 'featurescript') || hasTerm(name, 'mworks') || hasTerm(name, 'generativecomponents') || hasTerm(name, 'ladybug') || hasTerm(name, 'dynamo') || hasTerm(name, 'grasshopper')) return 'full';
        if (category === 'CAD' && type !== '2d_cad') return 'full';
        if (category === 'BIM') return 'full';
        if (type === 'cad_automation') return 'full';
        return 'none';

      case 'visual_programming':
        if (type === 'cad_automation' || hasTerm(strengths, '视觉编程') || hasTerm(strengths, '节点') || hasTerm(strengths, 'visual programming') || hasTerm(strengths, 'node-based') || hasTerm(name, 'nodes') || hasTerm(name, 'ladybug') || hasTerm(name, 'dynamo') || hasTerm(name, 'grasshopper') || hasTerm(name, 'generativecomponents')) return 'full';
        return 'none';

      case 'cad_repair_interop':
        if (category === 'CAD互操作' || type === 'cad_interop' || hasTerm(strengths, '互操作') || hasTerm(strengths, '修复') || hasTerm(strengths, '转换') || hasTerm(strengths, 'interop') || hasTerm(strengths, 'translation') || hasTerm(strengths, 'healing') || hasTerm(strengths, 'repair') || hasTerm(name, 'cadfix') || hasTerm(name, 'elysium') || hasTerm(name, 'exchanger')) return 'full';
        return 'none';

      case 'fea_structure':
        if (category === 'CAE' && (hasTerm(strengths, '结构') || hasTerm(strengths, '力学') || hasTerm(strengths, '有限元') || hasTerm(strengths, 'fea') || hasTerm(name, 'mechanical') || hasTerm(name, 'structure') || hasTerm(name, 'optistruct') || hasTerm(name, 'ansys') || hasTerm(name, 'simscale') || hasTerm(name, 'structure') || hasTerm(name, 'rfem') || hasTerm(name, 'civil') || hasTerm(name, '3d3s') || hasTerm(name, 'perform3d'))) return 'full';
        if (category === 'CAE' && !hasTerm(strengths, '流体') && !hasTerm(strengths, 'cfd') && !hasTerm(strengths, '电磁')) return 'partial';
        return 'none';

      case 'cfd_fluid':
        if (category === 'CAE' && (hasTerm(strengths, '流体') || hasTerm(strengths, 'cfd') || hasTerm(strengths, 'fluent') || hasTerm(name, 'star-ccm') || hasTerm(name, 'abyss') || hasTerm(name, 'cfd') || hasTerm(name, 'openfast'))) return 'full';
        return 'none';

      case 'electromagnetics':
        if ((category === 'CAE' || category === 'EDA') && (hasTerm(strengths, '电磁') || hasTerm(strengths, 'hfss') || hasTerm(strengths, '信号完整性') || hasTerm(strengths, 'si') || hasTerm(name, 'electromagnetic') || hasTerm(name, 'virtuoso') || hasTerm(name, 'alextool') || hasTerm(name, 'empyrean'))) return 'full';
        return 'none';

      case 'multi_physics':
        if (category === 'CAE' && (hasTerm(strengths, '多物理') || hasTerm(strengths, '多场') || hasTerm(strengths, 'comsol') || hasTerm(name, 'comsol') || hasTerm(name, 'pera-sim'))) return 'full';
        if (category === 'CAE') return 'partial';
        return 'none';

      case 'material_injection':
        if (hasTerm(strengths, '注塑') || hasTerm(strengths, '模流') || hasTerm(strengths, '材料') || hasTerm(strengths, 'injection') || hasTerm(strengths, 'moldflow') || hasTerm(strengths, 'materials') || hasTerm(strengths, 'polymer') || hasTerm(name, 'biovia') || hasTerm(name, 'mold') || hasTerm(name, 'moldflow') || hasTerm(name, 'mold3d')) return 'full';
        return 'none';

      case 'code_compliance':
        if (hasTerm(strengths, '规范') || hasTerm(strengths, '验算') || hasTerm(strengths, '出图') || hasTerm(strengths, '合规') || hasTerm(strengths, '国标') || hasTerm(name, 'pkpm') || hasTerm(name, 'yjk') || hasTerm(name, 'doctor-bridge')) return 'full';
        return 'none';

      case 'opt_light_acoustics':
        if (hasTerm(strengths, '光学') || hasTerm(strengths, '声学') || hasTerm(strengths, '能耗') || hasTerm(strengths, '日照') || hasTerm(strengths, '光照') || hasTerm(strengths, 'acoustic') || hasTerm(strengths, 'optics') || hasTerm(strengths, 'optical') || hasTerm(name, 'zemax') || hasTerm(name, 'code v') || hasTerm(name, 'ladybug') || hasTerm(name, 'honeybee') || hasTerm(name, 'dragonfly')) return 'full';
        return 'none';

      case 'analog_ic_design':
        if (hasTerm(strengths, '模拟ic') || hasTerm(strengths, '模拟设计') || hasTerm(strengths, '模拟芯片') || hasTerm(name, 'virtuoso') || hasTerm(name, 'alextool') || hasTerm(strengths, 'spice') || hasTerm(strengths, 'device modeling') || hasTerm(strengths, '器件建模')) return 'full';
        if (category === 'EDA' && (hasTerm(strengths, '模拟') || hasTerm(strengths, 'analog'))) return 'full';
        return 'none';

      case 'digital_ic_synthesis':
        if (hasTerm(strengths, '数字综合') || hasTerm(strengths, '数字后端') || hasTerm(strengths, '布局布线') || hasTerm(name, 'innovus') || hasTerm(strengths, 'synthesis') || hasTerm(strengths, 'place and route') || hasTerm(name, 'design compiler')) return 'full';
        if (category === 'EDA' && (hasTerm(strengths, '数字') || hasTerm(strengths, 'digital'))) return 'full';
        return 'none';

      case 'formal_verification':
        if (hasTerm(strengths, '形式验证') || hasTerm(strengths, '等价性') || hasTerm(strengths, '验证') || hasTerm(strengths, 'formal') || hasTerm(strengths, 'equivalence') || hasTerm(strengths, 'verification') || hasTerm(name, 'smit eda') || hasTerm(name, 'orca') || hasTerm(name, 'guowei') || hasTerm(name, 'haps')) return 'full';
        if (category === 'EDA' && hasTerm(strengths, '验证')) return 'full';
        return 'none';

      case 'physical_prototyping':
        if (hasTerm(strengths, '原型验证') || hasTerm(strengths, '硬件仿真') || hasTerm(name, 'haps') || hasTerm(name, 'protium') || hasTerm(name, 'zeebu') || hasTerm(strengths, 'prototyping') || hasTerm(strengths, 'emulation')) return 'full';
        return 'none';

      case 'tcad_device_sim':
        if (hasTerm(name, 'tcad') || hasTerm(strengths, 'tcad') || hasTerm(strengths, '工艺器件') || hasTerm(name, 'sentaurus') || hasTerm(name, 'silvaco') || hasTerm(strengths, 'device simulation')) return 'full';
        return 'none';

      case 'fab_automation_eap':
        if (hasTerm(name, 'eap') || hasTerm(strengths, 'eap') || hasTerm(strengths, '设备自动化') || hasTerm(strengths, 'sec/gem') || hasTerm(name, 'applied e3') || hasTerm(name, 'semitech') || hasTerm(name, 'plantu')) return 'full';
        return 'none';

      case 'yield_yms':
        if (hasTerm(strengths, '良率') || hasTerm(name, 'yms') || hasTerm(strengths, 'wat') || hasTerm(name, 'exensio') || hasTerm(strengths, 'yield') || hasTerm(name, 'semitron')) return 'full';
        return 'none';

      case 'bom_mgmt':
        if (category === 'PLM' || category === 'ERP') return 'full';
        if (category === 'CAD' || category === 'MES') return 'partial';
        return 'none';

      case 'lifecycle_mgmt':
        if (category === 'PLM') return 'full';
        if (category === 'ERP' || category === 'EAM') return 'partial';
        return 'none';

      case 'requirements_trace':
        if (hasTerm(strengths, '需求') || hasTerm(strengths, '合规') || hasTerm(strengths, '追溯') || hasTerm(strengths, 'lims') || hasTerm(name, 'polarion') || hasTerm(name, 'biovia') || hasTerm(strengths, 'requirements') || hasTerm(strengths, 'traceability') || hasTerm(strengths, 'compliance')) return 'full';
        return 'none';

      case 'mbse_sys':
        if (category === 'MBSE' || hasTerm(strengths, 'mbse') || hasTerm(strengths, '系统建模') || hasTerm(name, 'mworks') || hasTerm(name, 'simulink')) return 'full';
        return 'none';

      case 'finance_ledger':
        if (category === 'ERP' && (hasTerm(strengths, '财务') || hasTerm(strengths, '账') || hasTerm(strengths, '资') || hasTerm(strengths, 'sap') || hasTerm(strengths, 'oracle') || hasTerm(strengths, 'yonyou') || hasTerm(strengths, 'kingdee') || hasTerm(name, 'erp') || hasTerm(name, 'bip') || hasTerm(name, 'cosmic') || hasTerm(name, 'netsuite'))) return 'full';
        return 'none';

      case 'cam_milling_cnc':
        if (category === 'CAM' || hasTerm(strengths, '数控') || hasTerm(strengths, '加工') || hasTerm(strengths, '铣') || hasTerm(strengths, '车削') || hasTerm(strengths, '雕刻') || hasTerm(strengths, 'cam') || hasTerm(strengths, 'cnc') || hasTerm(strengths, 'milling') || hasTerm(name, 'powermill') || hasTerm(name, 'mastercam') || hasTerm(name, 'surfmill') || hasTerm(name, 'cypcut') || hasTerm(name, 'weihong')) return 'full';
        return 'none';

      case 'scheduling_ops':
        if (category === 'MES' && (hasTerm(strengths, '排程') || hasTerm(strengths, 'aps') || hasTerm(strengths, 'scheduling'))) return 'full';
        if (category === 'MES') return 'partial';
        return 'none';

      case 'process_control':
        if (category === 'DCS' || category === 'SCADA') return 'full';
        if (category === 'MES') return 'partial';
        return 'none';

      case 'data_acquisition':
        if (category === 'SCADA' || category === '工业互联网' || category === 'MES' || type === 'iiot_platform' || hasTerm(strengths, '数据采集') || hasTerm(strengths, '采集') || hasTerm(strengths, 'iot') || hasTerm(strengths, 'mqtt')) return 'full';
        return 'none';

      case 'bim_clash':
        if (category === 'BIM' && (tags.includes('clash_detection') || hasTerm(strengths, '碰撞') || hasTerm(strengths, '协同') || hasTerm(strengths, '联邦') || hasTerm(name, 'navisworks') || hasTerm(name, 'bimface'))) return 'full';
        if (category === 'BIM') return 'partial';
        return 'none';

      case 'gis_spatial':
        if (category === 'GIS' || hasTerm(strengths, '地理') || hasTerm(strengths, '空间') || hasTerm(strengths, '地图') || hasTerm(strengths, 'gis') || hasTerm(name, 'arcgis') || hasTerm(name, 'supermap')) return 'full';
        return 'none';

      case 'slicing_algorithm':
        if (category === '切片软件' || tags.includes('am_slicing') || hasTerm(strengths, '切片') || hasTerm(strengths, 'slicing') || hasTerm(strengths, 'slicer') || hasTerm(name, 'cura') || hasTerm(name, 'bambu') || hasTerm(name, 'orca-slicer') || hasTerm(name, 'prusaslicer') || hasTerm(name, 'chitubox') || hasTerm(name, 'flashprint')) return 'full';
        return 'none';

      case 'am_layout':
        if (category === '切片软件' && (hasTerm(strengths, '排版') || hasTerm(strengths, '排产') || hasTerm(strengths, '修复') || hasTerm(strengths, '支撑') || hasTerm(name, 'netfabb') || hasTerm(name, 'magics') || hasTerm(name, 'hps') || hasTerm(name, 'nesting'))) return 'full';
        return 'none';

      case 'cloud_native':
        if (tags.includes('cloud_native') || hasTerm(strengths, '云原生') || hasTerm(strengths, 'saas') || hasTerm(strengths, '浏览器') || hasTerm(strengths, 'web') || hasTerm(strengths, 'cloud') || hasTerm(name, 'crowncad') || hasTerm(name, 'onshape')) return 'full';
        if (hasTerm(limitations, '云') || hasTerm(limitations, 'saas化') || hasTerm(limitations, 'cloud')) return 'partial';
        return 'none';

      case 'collaboration':
        if (tags.includes('federated_bim') || hasTerm(strengths, '协同') || hasTerm(strengths, '多专业') || hasTerm(strengths, 'cooperation') || hasTerm(strengths, 'collaboration') || hasTerm(strengths, '共享') || hasTerm(strengths, '多用户') || hasTerm(name, 'bimface') || hasTerm(name, 'sview')) return 'full';
        return 'none';

      case 'ext_api':
        if (tags.includes('cad_scripting') || hasTerm(strengths, 'api') || hasTerm(strengths, '二次开发') || hasTerm(strengths, '脚本') || hasTerm(strengths, 'sdk') || hasTerm(strengths, 'featurescript') || hasTerm(name, 'featurescript') || hasTerm(name, 'bimface') || hasTerm(strengths, '工具链') || hasTerm(strengths, '编译') || hasTerm(strengths, '开发工具') || hasTerm(strengths, 'toolchain') || hasTerm(strengths, 'compiler')) return 'full';
        if (hasTerm(limitations, 'api') || hasTerm(limitations, '开发') || hasTerm(limitations, '生态')) return 'partial';
        return 'none';

      case 'xinchuang_compat':
        if (tags.includes('xinchuang') || hasTerm(strengths, '信创') || hasTerm(strengths, '适配') || hasTerm(strengths, '国产化') || hasTerm(strengths, '替代') || hasTerm(strengths, '自主')) return 'full';
        return 'none';

      default:
        return 'none';
    }
  }

  function applyFilters() {
    let list = CAT().allProducts || [];
    if (state.filterOrigin) list = list.filter((p) => p.origin === state.filterOrigin);
    if (state.filterCategory) list = list.filter((p) => p.category_l2 === state.filterCategory);
    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter((p) => {
        const v = CAT().getVendor(p.vendor_id);
        return (p.name_zh + p.name_en + p.id + (v ? v.name_zh + v.name_en : '')).toLowerCase().includes(q);
      });
    }
    return list;
  }

  // Per-product capability coverage tally over the full taxonomy.
  function coverage(p) {
    let full = 0;
    let partial = 0;
    CAPABILITIES.forEach((cap) => {
      const s = evaluateCapability(p, cap.key);
      if (s === 'full') full++;
      else if (s === 'partial') partial++;
    });
    return { full, partial, none: CAPABILITIES.length - full - partial };
  }

  function renderTable() {
    const thead = document.querySelector('.matrix-table thead');
    const tbody = document.getElementById('matrix-tbody');
    if (!thead || !tbody) return;

    let list = applyFilters();
    const isEn = I18N().isEn && I18N().isEn();

    // Optional sort by product name or capability coverage (full count, tiebreak partial).
    if (state.sortKey === 'name') {
      list = list.slice().sort((a, b) => {
        const va = (isEn ? a.name_en : a.name_zh) || '';
        const vb = (isEn ? b.name_en : b.name_zh) || '';
        return va.localeCompare(vb) * state.sortDir;
      });
    } else if (state.sortKey === 'coverage') {
      list = list.slice().sort((a, b) => {
        const ca = coverage(a); const cb = coverage(b);
        return ((ca.full - cb.full) || (ca.partial - cb.partial)) * state.sortDir;
      });
    }

    const countEl = document.getElementById('matrix-count');
    if (countEl) countEl.textContent = list.length;
    const clearBtn = document.getElementById('matrix-clear-filters');
    if (clearBtn) clearBtn.hidden = !(state.filterOrigin || state.filterCategory || state.search);

    // Resolve each domain's column span against the live capability order.
    const keyToCap = {};
    CAPABILITIES.forEach((c) => { keyToCap[c.key] = c; });

    // Row 1 — domain group headers (3 fixed columns span both header rows).
    const domainCells = CAP_DOMAINS.map((dom, i) => {
      const label = isEn ? dom.en : dom.zh;
      const tone = i % 2 === 0 ? 'bg-slate-100/80' : 'bg-slate-50';
      return `<th colspan="${dom.keys.length}" class="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 border-b border-l border-slate-200 ${tone}">${label}</th>`;
    }).join('');

    // Row 2 — individual capability headers (in domain order).
    const capHeaders = CAP_DOMAINS.map((dom) => dom.keys.map((key) => {
      const cap = keyToCap[key];
      if (!cap) return '';
      const label = isEn ? cap.en : cap.zh;
      const alt = isEn ? cap.zh : cap.en;
      return `<th class="px-1.5 py-2 text-center min-w-[64px] max-w-[88px] border-b border-slate-200 select-none align-bottom" title="${label} · ${alt}"><span class="matrix-cap-label">${label}</span></th>`;
    }).join('')).join('');

    const sortCls = (key) => `th-sort matrix-sort${state.sortKey === key ? (state.sortDir < 0 ? ' sort-desc' : ' sort-asc') : ''}`;
    thead.innerHTML = `
      <tr>
        <th rowspan="2" data-matrix-sort="name" class="matrix-sticky-col ${sortCls('name')} px-3 py-2 text-left w-[150px] min-w-[150px] border-b border-r border-slate-200 align-bottom">${isEn ? 'Product' : '产品'}</th>
        <th rowspan="2" class="px-2 py-2 text-center w-[72px] min-w-[72px] border-b border-r border-slate-200 align-bottom">${isEn ? 'Category' : '品类'}</th>
        <th rowspan="2" data-matrix-sort="coverage" class="${sortCls('coverage')} px-2 py-2 text-center w-[64px] min-w-[64px] border-b border-r border-slate-200 align-bottom" title="${isEn ? 'Capabilities supported / partial — click to sort' : '支持 / 半支持能力数 — 点击排序'}">${isEn ? 'Cov.' : '覆盖'}</th>
        ${domainCells}
      </tr>
      <tr>${capHeaders}</tr>
    `;

    // Rows
    tbody.innerHTML = '';
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="${CAPABILITIES.length + 3}" class="text-center py-8 text-slate-500">${isEn ? 'No products match filters' : '没有匹配的产品'}</td></tr>`;
      return;
    }

    list.forEach((p) => {
      const tr = document.createElement('tr');
      tr.className = 'border-b border-slate-100 hover:bg-slate-50/80';

      const prodName = isEn ? p.name_en : p.name_zh;
      const catLabel = p.category_l2;
      const cov = coverage(p);

      let cells = `
        <td class="matrix-sticky-col px-3 py-2 text-left font-medium text-slate-900 border-r border-slate-100" title="${prodName}">
          <a href="#product=${p.id}" class="text-slate-900 hover:text-emerald-700 hover:underline transition-colors">${prodName}</a>
        </td>
        <td class="px-2 py-2 text-center text-slate-500 border-r border-slate-100 whitespace-nowrap">${catLabel}</td>
        <td class="px-2 py-2 text-center border-r border-slate-100 whitespace-nowrap" title="${isEn ? 'Supported' : '支持'} ${cov.full} · ${isEn ? 'Partial' : '半支持'} ${cov.partial}">
          <span class="text-emerald-600 font-semibold">${cov.full}</span><span class="text-slate-300">/</span><span class="text-amber-500 font-medium">${cov.partial}</span>
        </td>
      `;

      CAP_DOMAINS.forEach((dom) => dom.keys.forEach((key) => {
        const score = evaluateCapability(p, key);
        let cellContent = '';
        if (score === 'full') {
          cellContent = `<span class="matrix-check text-emerald-600 font-bold text-sm" title="${isEn ? 'Supported' : '支持'}">✔</span>`;
        } else if (score === 'partial') {
          cellContent = `<span class="matrix-partial text-amber-500 font-medium text-base" style="line-height: 1" title="${isEn ? 'Partial/Developing' : '半支持/正在发展'}">◌</span>`;
        } else {
          cellContent = `<span class="matrix-none text-slate-200 select-none">—</span>`;
        }
        cells += `<td class="px-1.5 py-2 text-center border-r border-slate-100">${cellContent}</td>`;
      }));

      tr.innerHTML = cells;
      tbody.appendChild(tr);
    });
  }

  function populateFilters() {
    const catSel = document.getElementById('matrix-filter-category');
    if (!catSel) return;
    const prods = CAT().allProducts || [];
    const counts = {};
    prods.forEach((p) => { counts[p.category_l2] = (counts[p.category_l2] || 0) + 1; });
    const isEn = I18N().isEn && I18N().isEn();
    const allLabel = isEn ? 'All categories' : '全部品类';
    catSel.innerHTML = `<option value="">${allLabel} (${prods.length})</option>`;
    Object.keys(counts).sort().forEach((l2) => {
      const opt = document.createElement('option');
      opt.value = l2;
      opt.textContent = `${l2} (${counts[l2]})`;
      catSel.appendChild(opt);
    });
    // Preserve the active selection across re-population (e.g. language switch).
    catSel.value = state.filterCategory || '';
  }

  function bindEvents() {
    document.getElementById('matrix-filter-origin')?.addEventListener('change', (e) => {
      state.filterOrigin = e.target.value;
      renderTable();
    });
    document.getElementById('matrix-filter-category')?.addEventListener('change', (e) => {
      state.filterCategory = e.target.value;
      renderTable();
    });
    document.getElementById('matrix-search')?.addEventListener('input', (e) => {
      state.search = e.target.value;
      renderTable();
    });
    // Sortable headers (thead is regenerated each render → delegate on the stable table).
    document.querySelector('.matrix-table')?.addEventListener('click', (e) => {
      const th = e.target.closest('[data-matrix-sort]');
      if (!th) return;
      const key = th.dataset.matrixSort;
      if (state.sortKey === key) state.sortDir *= -1;
      else { state.sortKey = key; state.sortDir = 1; }
      renderTable();
    });
    document.getElementById('matrix-clear-filters')?.addEventListener('click', () => {
      state.filterOrigin = '';
      state.filterCategory = '';
      state.search = '';
      const o = document.getElementById('matrix-filter-origin');
      const c = document.getElementById('matrix-filter-category');
      const s = document.getElementById('matrix-search');
      if (o) o.value = '';
      if (c) c.value = '';
      if (s) s.value = '';
      renderTable();
    });
  }

  function init() {
    populateFilters();
    bindEvents();
    renderTable();
  }

  window.INDUSTRIAL_MATRIX = {
    init,
    render: renderTable,
    populateFilters,
    evaluateCapability,
    coverage,
    CAPABILITIES,
    CAP_DOMAINS,
  };
})();
