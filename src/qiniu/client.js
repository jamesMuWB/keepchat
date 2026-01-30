const qiniu = require('qiniu');

const REGION_ZONE_MAP = {
  z0: qiniu.zone.Zone_z0,
  z1: qiniu.zone.Zone_z1,
  z2: qiniu.zone.Zone_z2,
  cnEast2: qiniu.zone.Zone_cn_east_2,
  'cn-east-2': qiniu.zone.Zone_cn_east_2,
  na0: qiniu.zone.Zone_na0,
  as0: qiniu.zone.Zone_as0,
};

function resolveZone(region) {
  if (!region) {
    throw new Error('Qiniu region is required');
  }

  const normalized = String(region).trim();
  const zone = REGION_ZONE_MAP[normalized];

  if (!zone) {
    throw new Error(`Unsupported Qiniu region: ${region}`);
  }

  return zone;
}

function createQiniuConfig(region) {
  const config = new qiniu.conf.Config();
  config.zone = resolveZone(region);
  return config;
}

function createMac(accessKey, secretKey) {
  if (!accessKey || !secretKey) {
    throw new Error('Qiniu accessKey and secretKey are required');
  }

  return new qiniu.auth.digest.Mac(accessKey, secretKey);
}

function createQiniuClient({ accessKey, secretKey, region }) {
  const mac = createMac(accessKey, secretKey);
  const config = createQiniuConfig(region);
  const bucketManager = new qiniu.rs.BucketManager(mac, config);
  const formUploader = new qiniu.form_up.FormUploader(config);
  const resumeUploader = new qiniu.resume_up.ResumeUploader(config);

  return {
    mac,
    config,
    bucketManager,
    formUploader,
    resumeUploader,
  };
}

module.exports = {
  createQiniuClient,
  createQiniuConfig,
  createMac,
  resolveZone,
};
