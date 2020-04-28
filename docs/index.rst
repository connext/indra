.. Connext documentation master file, created by
   sphinx-quickstart on Wed Apr  3 12:06:15 2019.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

Connext Documentation
===================================

Connext is an infrastructure layer on top of Ethereum that lets Ethereum wallets, applications and protocols do instant, high volume transactions with arbitrarily complex conditions for settlement. Projects that integrate Connext can enable users to batch up Ethereum interactions to get more transaction throughput per block.

These docs cover both the background of Connext and how to get started integrating Connext into your Ethereum wallet or application.

""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

*********
Community
*********

`Join the community 
<https://discord.gg/raNmNb5>`_ to meet the team, discuss development, and hang out!


""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

*********
Contents
*********

.. toctree::
    :maxdepth: 2
    :caption: Background

    background/introduction
    background/faq
    background/architecture

.. toctree::
    :maxdepth: 2
    :caption: Client Documentation

    user/quickStart
    user/walletIntegrations
    user/advanced
    user/limitations
    user/clientAPI
    user/daiCard
    user/storeModule
    user/types

.. toctree::
    :maxdepth: 2
    :caption: Node Documentation

    nodeOperator/node
    nodeOperator/runNode

.. toctree::
    :maxdepth: 2
    :caption: Protocol

    protocol/introduction
    protocol/diagram
    protocol/api

.. toctree::
    :maxdepth: 2
    :caption: Contributor Documentation

    contributor/CONTRIBUTING
    contributor/workflow-protocols.md
    README
