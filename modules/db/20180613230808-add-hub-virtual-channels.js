'use strict'

var dbm
var type
var seed

/**
 * We receive the dbmigrate dependency from dbmigrate initially.
 * This enables us to not have to rely on NODE_PATH.
 */
exports.setup = function(options, seedLink) {
  dbm = options.dbmigrate
  type = dbm.dataType
  seed = seedLink
}

exports.up = function(db) {
  return db.runSql(`
    CREATE INDEX virtual_channel_state_updates_nonce_idx ON virtual_channel_state_updates(nonce);

    CREATE OR REPLACE VIEW hub_virtual_channels AS                                                                                                                                                                      
      WITH vcs AS (                                                                                                                                                                                                          
        SELECT                                                                                                                                                                                                                 
          vc.id                                   id,                                                                                                                                                                           
          vc.channel_id                           channel_id,                                                                                                                                                                   
          vc.party_a                              party_a,                                                                                                                                                                      
          vc.party_b                              party_b,                                                                                                                                                                      
          vc.party_i                              party_i,                                                                                                                                                                      
          vc.subchan_a_to_i                       subchan_a_to_i,                                                                                                                                                               
          vc.subchan_b_to_i                       subchan_b_to_i,                                                                                                                                                               
          COALESCE(vcsu.wei_balance_a, 0)         wei_balance_a,                                                                                                                                                                    
          COALESCE(vcsu.wei_balance_b, 0)         wei_balance_b,                                                                                                                                                                    
          COALESCE(vcsu.nonce, 0)                 nonce,                                                                                                                                                                            
          vc.status                               status                                                                                                                                                                          
        FROM virtual_channels vc                                                                                                                                                                                                    
        JOIN virtual_channel_state_updates vcsu ON vcsu.channel_id = vc.channel_id                                                                                                                                              
      )    

      SELECT t1.* FROM vcs t1
      LEFT JOIN vcs t2
      ON t1.id = t2.id AND t1.nonce < t2.nonce
      WHERE t2.nonce IS NULL
      ORDER BY t1.nonce DESC
  `)
  // https://stackoverflow.com/questions/9796078/selecting-rows-ordered-by-some-column-and-distinct-on-another
}

exports.down = function(db) {
  return null
}

exports._meta = {
  version: 1,
}
